// File: src/Dictionary/Dictionary.jsx
import { BookOpen } from 'lucide-react';
import { dictionaryApi } from '../api/apiClient';
import EntriesPage from '../components/entries/EntriesPage';
import DictionaryBanner from './components/DictionaryBanner';
import WordModal from './components/WordModal';

const CONFIG = {
  api: dictionaryApi,
  title: 'Dictionary',
  noun: 'word',
  emptyIcon: BookOpen,
  banner: <DictionaryBanner />,
  EntryModal: WordModal,
  importHelp: 'One word per line. Use "misspelling -> Correct spelling" for corrections. CSV "phrase,replacement" also works.',
};

export default function Dictionary() {
  return <EntriesPage config={CONFIG} />;
}
