// FlowHelper.cs - native companion process for the Whisper Flow desktop app
// (the equivalent of Wispr Flow's "Wispr Flow Helper.exe").
//
// Electron cannot see key *releases* globally, which push-to-talk needs, and
// cannot synthesize Ctrl+V into other apps. This helper does both:
//   * a low-level keyboard hook that matches the user's shortcut bindings and
//     reports hold (down/up) and press events,
//   * SendInput for paste / copy, foreground-app + browser-URL lookup, and
//     muting system audio while dictating.
//
// Protocol: one command per stdin line, tab separated ("paste\t17"); events and
// results are JSON lines on stdout. Written for C# 5 so it compiles with the
// csc.exe that ships with Windows (.NET Framework 4.x).
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Automation;

namespace WhisperFlow
{
    internal static class Program
    {
        // ------------------------------------------------------------------
        // Output (a dedicated writer thread keeps the hook callback fast)
        // ------------------------------------------------------------------
        private static readonly BlockingCollection<string> Outbox = new BlockingCollection<string>();

        private static void Emit(string json)
        {
            Outbox.Add(json);
        }

        private static string Q(string s)
        {
            if (s == null) return "null";
            var sb = new StringBuilder("\"");
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.Append('"').ToString();
        }

        private static string KeysJson(IEnumerable<string> keys)
        {
            var parts = new List<string>();
            foreach (var k in keys) parts.Add(Q(k));
            return "[" + string.Join(",", parts.ToArray()) + "]";
        }

        // ------------------------------------------------------------------
        // Win32
        // ------------------------------------------------------------------
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100, WM_KEYUP = 0x0101, WM_SYSKEYDOWN = 0x0104, WM_SYSKEYUP = 0x0105;
        private const uint LLKHF_INJECTED = 0x10;
        private const uint INPUT_KEYBOARD = 1;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private static readonly IntPtr FlowMarker = new IntPtr(0x464C4F57); // "FLOW"

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

        [StructLayout(LayoutKind.Sequential)]
        private struct KBDLLHOOKSTRUCT { public uint vkCode; public uint scanCode; public uint flags; public uint time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Sequential)]
        private struct HARDWAREINPUT { public uint uMsg; public ushort wParamL; public ushort wParamH; }

        [StructLayout(LayoutKind.Explicit)]
        private struct InputUnion
        {
            [FieldOffset(0)] public MOUSEINPUT mi;
            [FieldOffset(0)] public KEYBDINPUT ki;
            [FieldOffset(0)] public HARDWAREINPUT hi;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT { public uint type; public InputUnion U; }

        [StructLayout(LayoutKind.Sequential)]
        private struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public int ptX; public int ptY; }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);
        [DllImport("user32.dll")]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);
        [DllImport("user32.dll")]
        private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);
        [DllImport("user32.dll")]
        private static extern bool TranslateMessage(ref MSG lpMsg);
        [DllImport("user32.dll")]
        private static extern IntPtr DispatchMessage(ref MSG lpMsg);
        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        private static LowLevelKeyboardProc hookProc; // kept alive for the GC
        private static IntPtr hookHandle = IntPtr.Zero;

        // Test mode (FLOWHELPER_DEBUG=1): the hook also processes synthetic key
        // events (except its own), so shortcuts can be exercised by a script.
        private static readonly bool DebugMode = Environment.GetEnvironmentVariable("FLOWHELPER_DEBUG") == "1";

        // ------------------------------------------------------------------
        // Key names <-> virtual-key codes
        // ------------------------------------------------------------------
        private static string KeyName(uint vk)
        {
            if (vk == 0x10 || vk == 0xA0 || vk == 0xA1) return "Shift";
            if (vk == 0x11 || vk == 0xA2 || vk == 0xA3) return "Ctrl";
            if (vk == 0x12 || vk == 0xA4 || vk == 0xA5) return "Alt";
            if (vk == 0x5B || vk == 0x5C) return "Win";
            if (vk == 0x20) return "Space";
            if (vk == 0x1B) return "Esc";
            if (vk == 0x09) return "Tab";
            if (vk == 0x0D) return "Enter";
            if (vk == 0x08) return "Backspace";
            if (vk == 0x14) return "CapsLock";
            if (vk >= 0x41 && vk <= 0x5A) return ((char)vk).ToString();
            if (vk >= 0x30 && vk <= 0x39) return ((char)vk).ToString();
            if (vk >= 0x70 && vk <= 0x87) return "F" + (vk - 0x70 + 1);
            return null;
        }

        private static bool IsModifier(string name)
        {
            return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Win";
        }

        private static int[] VirtualKeys(string name)
        {
            switch (name)
            {
                case "Shift": return new[] { 0x10 };
                case "Ctrl": return new[] { 0x11 };
                case "Alt": return new[] { 0x12 };
                case "Win": return new[] { 0x5B, 0x5C };
                case "Space": return new[] { 0x20 };
                case "Esc": return new[] { 0x1B };
                case "Tab": return new[] { 0x09 };
                case "Enter": return new[] { 0x0D };
                case "Backspace": return new[] { 0x08 };
                case "CapsLock": return new[] { 0x14 };
            }
            if (name.Length == 1) return new[] { (int)name[0] };
            if (name.StartsWith("F")) return new[] { 0x70 + int.Parse(name.Substring(1)) - 1 };
            return new int[0];
        }

        // Key-ups can be missed (e.g. Win+L locks the screen and the release goes
        // to the secure desktop). Drop keys that are no longer physically down.
        // Swallowed keys never reach Windows, so GetAsyncKeyState reports them
        // as up even while held: those (and everything during capture) are
        // trusted from our own key-down/up tracking instead.
        private static void ReconcilePressed(string current)
        {
            if (capturing) return;
            var stale = new List<string>();
            foreach (var key in Pressed)
            {
                if (key == current) continue;
                uint swallowedVk;
                if (PressedVk.TryGetValue(key, out swallowedVk) && Swallowed.Contains(swallowedVk)) continue;
                bool down = false;
                foreach (int vk in VirtualKeys(key)) if ((GetAsyncKeyState(vk) & 0x8000) != 0) down = true;
                if (!down) stale.Add(key);
            }
            foreach (var key in stale) Pressed.Remove(key);
            if (stale.Count > 0 && activeHold != null && !Bindings[activeHold].IsSubsetOf(Pressed)) activeHold = null;
        }

        // ------------------------------------------------------------------
        // Shortcut state machine (runs inside the hook callback)
        // ------------------------------------------------------------------
        private static readonly object Gate = new object();
        private static readonly Dictionary<string, HashSet<string>> Bindings = new Dictionary<string, HashSet<string>>();
        private static readonly HashSet<string> HoldActions = new HashSet<string>(new[] { "push_to_talk", "command_mode" });
        private static readonly HashSet<string> Pressed = new HashSet<string>();
        private static readonly Dictionary<string, uint> PressedVk = new Dictionary<string, uint>();
        private static readonly HashSet<uint> Swallowed = new HashSet<uint>();
        private static string activeHold = null;
        private static bool foreignKeyDown = false; // a key we don't track is held
        private static volatile bool recording = false;
        private static volatile bool capturing = false;
        private static readonly HashSet<string> CaptureBest = new HashSet<string>();

        private static string MatchBinding()
        {
            foreach (var pair in Bindings)
            {
                if (pair.Value.SetEquals(Pressed)) return pair.Key;
            }
            return null;
        }

        // Pressing Win (or Alt) alone and releasing opens the Start menu (or the
        // menu bar). Injecting an unassigned key while it is held prevents that.
        private static void MaskModifierRelease()
        {
            if (Pressed.Contains("Win") || Pressed.Contains("Alt"))
            {
                ThreadPool.QueueUserWorkItem(delegate { TapKey(0xE8); });
            }
        }

        private static bool OnKeyDown(uint vk)
        {
            string name = KeyName(vk);
            if (name == null)
            {
                foreignKeyDown = true;
                // Another shortcut (e.g. Ctrl+Win+Left) - abandon an active hold.
                if (activeHold != null)
                {
                    Emit("{\"type\":\"hotkey\",\"action\":" + Q(activeHold) + ",\"phase\":\"cancel\"}");
                    activeHold = null;
                }
                return false;
            }
            ReconcilePressed(name);
            bool repeat = Pressed.Contains(name);
            Pressed.Add(name);
            PressedVk[name] = vk;

            if (capturing)
            {
                if (Pressed.Count >= CaptureBest.Count)
                {
                    CaptureBest.Clear();
                    CaptureBest.UnionWith(Pressed);
                }
                if (!repeat) Emit("{\"type\":\"capture\",\"keys\":" + KeysJson(CaptureBest) + ",\"final\":false}");
                if (Pressed.Contains("Win") || Pressed.Contains("Alt")) MaskModifierRelease();
                Swallowed.Add(vk);
                return true; // keep the keys away from the hub while recording a shortcut
            }
            if (repeat) return Swallowed.Contains(vk);

            string match = foreignKeyDown ? null : MatchBinding();
            if (match == null)
            {
                // A non-modifier turned the hold into some other shortcut
                // (e.g. Ctrl+Win+D for a new desktop): abandon the dictation.
                if (activeHold != null && !IsModifier(name))
                {
                    Emit("{\"type\":\"hotkey\",\"action\":" + Q(activeHold) + ",\"phase\":\"cancel\"}");
                    activeHold = null;
                }
                return false;
            }

            if (match == "cancel" && !recording) return false;

            MaskModifierRelease();
            if (HoldActions.Contains(match))
            {
                if (activeHold != match)
                {
                    activeHold = match;
                    Emit("{\"type\":\"hotkey\",\"action\":" + Q(match) + ",\"phase\":\"down\"}");
                }
            }
            else
            {
                // A press binding that extends a hold (Ctrl+Win -> Ctrl+Win+Space)
                // converts it: releasing the keys must not end the dictation.
                activeHold = null;
                Emit("{\"type\":\"hotkey\",\"action\":" + Q(match) + ",\"phase\":\"press\"}");
            }
            // Non-modifier keys that complete a shortcut never reach the app.
            if (!IsModifier(name))
            {
                Swallowed.Add(vk);
                return true;
            }
            return false;
        }

        private static bool OnKeyUp(uint vk)
        {
            string name = KeyName(vk);
            bool swallow = Swallowed.Remove(vk);
            if (name == null)
            {
                foreignKeyDown = false;
                return swallow;
            }
            Pressed.Remove(name);
            PressedVk.Remove(name);
            if (capturing)
            {
                if (Pressed.Count == 0 && CaptureBest.Count > 0)
                {
                    Emit("{\"type\":\"capture\",\"keys\":" + KeysJson(CaptureBest) + ",\"final\":true}");
                    CaptureBest.Clear();
                    capturing = false;
                }
                return true;
            }
            if (activeHold != null && Bindings.ContainsKey(activeHold) && Bindings[activeHold].Contains(name))
            {
                Emit("{\"type\":\"hotkey\",\"action\":" + Q(activeHold) + ",\"phase\":\"up\"}");
                activeHold = null;
            }
            if (Pressed.Count == 0) foreignKeyDown = false;
            return swallow;
        }

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                var data = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
                bool injected = data.dwExtraInfo == FlowMarker || (!DebugMode && (data.flags & LLKHF_INJECTED) != 0);
                if (!injected)
                {
                    int msg = wParam.ToInt32();
                    bool swallow = false;
                    try
                    {
                        lock (Gate)
                        {
                            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN) swallow = OnKeyDown(data.vkCode);
                            else if (msg == WM_KEYUP || msg == WM_SYSKEYUP) swallow = OnKeyUp(data.vkCode);
                        }
                    }
                    catch (Exception ex)
                    {
                        Emit("{\"type\":\"log\",\"message\":" + Q("hook error: " + ex.Message) + "}");
                    }
                    if (swallow) return new IntPtr(1);
                }
            }
            return CallNextHookEx(hookHandle, nCode, wParam, lParam);
        }

        // ------------------------------------------------------------------
        // Synthetic input
        // ------------------------------------------------------------------
        private static INPUT Key(ushort vk, bool up)
        {
            var input = new INPUT { type = INPUT_KEYBOARD };
            input.U.ki = new KEYBDINPUT { wVk = vk, dwFlags = up ? KEYEVENTF_KEYUP : 0, dwExtraInfo = FlowMarker };
            return input;
        }

        private static void TapKey(ushort vk)
        {
            var inputs = new[] { Key(vk, false), Key(vk, true) };
            SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        // Waits (briefly) until the user has let go of Win/Alt/Shift, otherwise
        // Ctrl+V would arrive as e.g. Ctrl+Win+V.
        private static void WaitForModifiersReleased()
        {
            int[] vks = { 0x5B, 0x5C, 0x12, 0x10 };
            for (int i = 0; i < 75; i++)
            {
                bool held = false;
                foreach (int vk in vks) if ((GetAsyncKeyState(vk) & 0x8000) != 0) held = true;
                if (!held) return;
                Thread.Sleep(20);
            }
        }

        private static void SendChord(ushort letter)
        {
            WaitForModifiersReleased();
            var inputs = new[] { Key(0x11, false), Key(letter, false), Key(letter, true), Key(0x11, true) };
            SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        // ------------------------------------------------------------------
        // Foreground app and browser URL
        // ------------------------------------------------------------------
        private static readonly HashSet<string> Browsers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "chrome", "msedge", "brave", "opera", "vivaldi", "firefox", "arc", "browser", "chromium", "zen"
        };

        private static string TryGetBrowserUrl(IntPtr hwnd, string processName)
        {
            var task = Task.Factory.StartNew(delegate
            {
                try
                {
                    var root = AutomationElement.FromHandle(hwnd);
                    if (root == null) return (string)null;
                    Condition condition = processName.Equals("firefox", StringComparison.OrdinalIgnoreCase)
                        ? (Condition)new PropertyCondition(AutomationElement.AutomationIdProperty, "urlbar-input")
                        : new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit);
                    var edit = root.FindFirst(TreeScope.Descendants, condition);
                    if (edit == null) return null;
                    object pattern;
                    if (edit.TryGetCurrentPattern(ValuePattern.Pattern, out pattern))
                    {
                        return ((ValuePattern)pattern).Current.Value;
                    }
                }
                catch (Exception) { }
                return null;
            });
            return task.Wait(450) ? task.Result : null;
        }

        private static string Foreground()
        {
            IntPtr hwnd = GetForegroundWindow();
            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            var title = new StringBuilder(512);
            GetWindowText(hwnd, title, title.Capacity);
            string processName = null, appName = null, url = null;
            try
            {
                var process = Process.GetProcessById((int)pid);
                processName = process.ProcessName;
                appName = processName;
                try
                {
                    string description = process.MainModule.FileVersionInfo.FileDescription;
                    if (!string.IsNullOrWhiteSpace(description)) appName = description.Trim();
                }
                catch (Exception) { }
            }
            catch (Exception) { }
            if (processName != null && Browsers.Contains(processName)) url = TryGetBrowserUrl(hwnd, processName);
            return "\"process\":" + Q(processName) + ",\"app\":" + Q(appName) + ",\"title\":" + Q(title.ToString()) +
                   ",\"url\":" + Q(url) + ",\"pid\":" + pid;
        }

        // ------------------------------------------------------------------
        // System audio mute (Core Audio)
        // ------------------------------------------------------------------
        [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        private class MMDeviceEnumerator { }

        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDeviceEnumerator
        {
            [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
            [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
        }

        [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDevice
        {
            [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object instance);
        }

        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioEndpointVolume
        {
            [PreserveSig] int RegisterControlChangeNotify(IntPtr notify);
            [PreserveSig] int UnregisterControlChangeNotify(IntPtr notify);
            [PreserveSig] int GetChannelCount(out uint count);
            [PreserveSig] int SetMasterVolumeLevel(float levelDb, ref Guid context);
            [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid context);
            [PreserveSig] int GetMasterVolumeLevel(out float levelDb);
            [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
            [PreserveSig] int SetChannelVolumeLevel(uint channel, float levelDb, ref Guid context);
            [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float level, ref Guid context);
            [PreserveSig] int GetChannelVolumeLevel(uint channel, out float levelDb);
            [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float level);
            [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
            [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
        }

        private static bool mutedByUs = false;

        private static IAudioEndpointVolume Endpoint()
        {
            var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
            IMMDevice device;
            Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0 /* eRender */, 1 /* eMultimedia */, out device));
            Guid iid = typeof(IAudioEndpointVolume).GUID;
            object instance;
            Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out instance));
            return (IAudioEndpointVolume)instance;
        }

        private static void SetSystemMute(bool mute)
        {
            var volume = Endpoint();
            Guid context = Guid.Empty;
            if (mute)
            {
                bool already;
                volume.GetMute(out already);
                if (!already)
                {
                    volume.SetMute(true, ref context);
                    mutedByUs = true;
                }
            }
            else if (mutedByUs)
            {
                // Only undo a mute we applied; never unmute the user's own mute.
                volume.SetMute(false, ref context);
                mutedByUs = false;
            }
        }

        // ------------------------------------------------------------------
        // Commands from Electron
        // ------------------------------------------------------------------
        private static void SetBindings(string spec)
        {
            // "push_to_talk:Ctrl+Win|hands_free:Ctrl+Win+Space|..."
            lock (Gate)
            {
                Bindings.Clear();
                activeHold = null;
                foreach (var part in spec.Split(new[] { '|' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    int colon = part.IndexOf(':');
                    if (colon <= 0) continue;
                    var keys = new HashSet<string>(part.Substring(colon + 1).Split(new[] { '+' }, StringSplitOptions.RemoveEmptyEntries));
                    if (keys.Count > 0) Bindings[part.Substring(0, colon)] = keys;
                }
            }
        }

        private static void Handle(string line)
        {
            string[] args = line.Split('\t');
            string command = args[0];
            string id = args.Length > 1 ? args[1] : "0";
            try
            {
                switch (command)
                {
                    case "bindings":
                        SetBindings(args.Length > 1 ? args[1] : "");
                        return;
                    case "state":
                        recording = (args.Length > 1 ? args[1] : "") == "recording";
                        return;
                    case "capture":
                        lock (Gate)
                        {
                            capturing = (args.Length > 1 ? args[1] : "") == "start";
                            CaptureBest.Clear();
                            activeHold = null;
                        }
                        return;
                    case "paste":
                        SendChord(0x56);
                        break;
                    case "copy":
                        SendChord(0x43);
                        break;
                    case "enter":
                        WaitForModifiersReleased();
                        TapKey(0x0D);
                        break;
                    case "foreground":
                        Emit("{\"type\":\"result\",\"id\":" + id + ",\"ok\":true," + Foreground() + "}");
                        return;
                    case "mute":
                        SetSystemMute(true);
                        break;
                    case "unmute":
                        SetSystemMute(false);
                        break;
                    case "ping":
                        break;
                    case "getmute":
                    {
                        bool muted;
                        Marshal.ThrowExceptionForHR(Endpoint().GetMute(out muted));
                        Emit("{\"type\":\"result\",\"id\":" + id + ",\"ok\":true,\"muted\":" + (muted ? "true" : "false") + "}");
                        return;
                    }
                    case "inject":
                    {
                        // Debug only: a key event the hook will see as user input.
                        if (!DebugMode) throw new InvalidOperationException("inject requires FLOWHELPER_DEBUG=1");
                        var input = new INPUT { type = INPUT_KEYBOARD };
                        input.U.ki = new KEYBDINPUT { wVk = (ushort)int.Parse(args[2]), dwFlags = args[3] == "up" ? KEYEVENTF_KEYUP : 0 };
                        SendInput(1, new[] { input }, Marshal.SizeOf(typeof(INPUT)));
                        break;
                    }
                    default:
                        Emit("{\"type\":\"result\",\"id\":" + id + ",\"ok\":false,\"error\":" + Q("unknown command " + command) + "}");
                        return;
                }
                Emit("{\"type\":\"result\",\"id\":" + id + ",\"ok\":true}");
            }
            catch (Exception ex)
            {
                Emit("{\"type\":\"result\",\"id\":" + id + ",\"ok\":false,\"error\":" + Q(ex.Message) + "}");
            }
        }

        [STAThread]
        private static int Main()
        {
            var stdout = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };
            var writer = new Thread(delegate ()
            {
                foreach (var line in Outbox.GetConsumingEnumerable()) stdout.WriteLine(line);
            }) { IsBackground = true };
            writer.Start();

            var reader = new Thread(delegate ()
            {
                var stdin = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
                string line;
                while ((line = stdin.ReadLine()) != null)
                {
                    string copy = line.Trim();
                    if (copy.Length == 0) continue;
                    // Slow commands (UI Automation, audio) must not block the next one.
                    ThreadPool.QueueUserWorkItem(delegate { Handle(copy); });
                }
                // Electron went away: restore audio and exit.
                try { SetSystemMute(false); } catch (Exception) { }
                Environment.Exit(0);
            }) { IsBackground = true };
            reader.Start();

            hookProc = HookCallback;
            using (var current = Process.GetCurrentProcess())
            using (var module = current.MainModule)
            {
                hookHandle = SetWindowsHookEx(WH_KEYBOARD_LL, hookProc, GetModuleHandle(module.ModuleName), 0);
            }
            if (hookHandle == IntPtr.Zero)
            {
                Emit("{\"type\":\"error\",\"message\":" + Q("Could not install the keyboard hook (error " + Marshal.GetLastWin32Error() + ")") + "}");
            }
            Emit("{\"type\":\"ready\",\"hook\":" + (hookHandle != IntPtr.Zero ? "true" : "false") + "}");

            MSG msg;
            while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
            {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }
            return 0;
        }
    }
}
