export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface UserProgress {
  level: Level;
  xp: number;
  completedScenarios: string[];
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  level: Level;
  hindiTranslation: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'intro',
    title: 'Pehli Mulaqat (First Meeting)',
    description: 'Introducing yourself to a new friend in English.',
    level: 1,
    hindiTranslation: 'Apna intro dena seekho.'
  },
  {
    id: 'cafe',
    title: 'Cafe Order',
    description: 'Ordering a masala chai and a snack at a cafe.',
    level: 2,
    hindiTranslation: 'Cafe mein order kaise dein?'
  },
  {
    id: 'market',
    title: 'Sabzi Mandi (Market)',
    description: 'Asking for prices and buying vegetables.',
    level: 3,
    hindiTranslation: 'Market mein rates kaise poochte hain?'
  },
  {
    id: 'interview',
    title: 'Job Interview',
    description: 'A mock interview for a software developer role.',
    level: 6,
    hindiTranslation: 'Kaam ki baate-cheet.'
  }
];
