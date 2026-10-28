// Generates src/data/subjects.json from the lists below.
// DRAFT: chapter titles follow the typical ICSE Grade 6 syllabus. Replace them with a
// transcription of Raaga's actual textbook contents pages (see docs/SEED_DATA.md).
import { writeFileSync } from 'node:fs';

const subjects = [
  { id: 'maths', name: 'Mathematics', kind: 'maths', color: '#e07a5f', chapters: [
    'Number System', 'Estimation', 'Numbers in India and International System', 'Place Value',
    'Natural Numbers and Whole Numbers', 'Negative Numbers and Integers', 'Number Line',
    'HCF and LCM', 'Playing with Numbers', 'Sets', 'Ratio', 'Proportion', 'Unitary Method',
    'Fractions', 'Decimal Fractions', 'Percent', 'Speed, Distance and Time',
    'Fundamental Concepts of Algebra', 'Simple Linear Equations', 'Fundamental Concepts of Geometry',
    'Angles', 'Properties of Angles and Lines', 'Triangles', 'Quadrilaterals', 'Polygons',
    'The Circle', 'Symmetry', 'Recognition of Solids', 'Perimeter and Area of Plane Figures', 'Data Handling'] },
  { id: 'history', name: 'History & Civics', kind: 'memory', color: '#c9a227', chapters: [
    'The Harappan Civilisation', 'The Mesopotamian Civilisation', 'The Egyptian Civilisation',
    'The Chinese Civilisation', 'The Vedic Period', 'Jainism and Buddhism', 'The Mauryan Empire',
    'The Sangam Age', 'The Age of the Guptas', 'The Medieval World: Christianity',
    'The Medieval World: Islam', 'Civics: Rural Local Self-Government', 'Civics: Urban Local Self-Government'] },
  { id: 'geography', name: 'Geography', kind: 'memory', color: '#3d9970', chapters: [
    'Representation of Geographical Features', 'Maps and Globes', 'Latitudes and Longitudes',
    'Rotation and Revolution', 'Landforms of the Earth', 'Water Bodies', 'Minerals', 'Agriculture',
    'Asia: Location, Extent and Physical Features', 'Asia: Climate and Natural Vegetation',
    'India: Location, Extent and Physical Features', 'India: Climate and Natural Vegetation'] },
  { id: 'biology', name: 'Biology', kind: 'memory', color: '#6ab04c', chapters: [
    'The Leaf', 'The Flower', 'Pollination and Fertilisation', 'Cell: Structure and Functions',
    'The Digestive System', 'Health and Hygiene', 'Habitat and Adaptation', 'Classification of Living Things'] },
  { id: 'physics', name: 'Physics', kind: 'science', color: '#4a90d9', chapters: [
    'Matter', 'Physical Quantities and Measurement', 'Force', 'Simple Machines',
    'Light Energy', 'Heat Energy', 'Magnetism'] },
  { id: 'chemistry', name: 'Chemistry', kind: 'science', color: '#9b59b6', chapters: [
    'Introduction to Chemistry', 'Elements, Compounds, Symbols and Formulae', 'Physical and Chemical Changes',
    'Matter and its States', 'Air and Atmosphere', 'Separation of Mixtures'] },
  { id: 'computers', name: 'Computer Studies', kind: 'other', color: '#16a085', chapters: [
    'Know Your Computer', 'Number Systems', 'Operating System Basics', 'Word Processing',
    'Presentations', 'Spreadsheets', 'Introduction to Programming', 'Internet Safety'] },
  { id: 'english-lang', name: 'English Language', kind: 'language', color: '#d35400', chapters: [
    'Nouns and Pronouns', 'Adjectives', 'Verbs and Tenses', 'Adverbs', 'Prepositions and Conjunctions',
    'Subject-Verb Agreement', 'Punctuation', 'Story Writing', 'Descriptive Essay', 'Informal Letter',
    'Formal Letter', 'Notice and Message Writing', 'Comprehension', 'Vocabulary'] },
  { id: 'english-lit', name: 'English Literature', kind: 'language', color: '#c0392b', chapters: [
    'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6', 'Unit 7', 'Unit 8'] },
  { id: 'second-lang', name: 'Hindi', kind: 'language', color: '#e84393', chapters: [
    'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6', 'Unit 7', 'Unit 8'] },
];

const out = {
  status: 'DRAFT: replace with transcription of contents-page photos, then set reviewed=true after Hema checks',
  reviewed: false,
  subjects: subjects.map((s) => ({
    id: s.id, name: s.name, kind: s.kind, color: s.color,
    chapters: s.chapters.map((title, i) => ({ id: `${s.id}-${i + 1}`, number: i + 1, title, weight: 1 })),
  })),
};
writeFileSync(new URL('../src/data/subjects.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('wrote', out.subjects.length, 'subjects');
