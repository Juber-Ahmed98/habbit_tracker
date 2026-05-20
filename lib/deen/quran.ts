// Static Quran reference data shipped with the app. No network required.
// Source: standard Mushaf — 114 surahs, 30 ajzāʾ. Names use the most common
// English transliterations + the meaning gloss. Ayah counts are canonical.

export type Surah = {
  /** 1-indexed surah number */
  n: number;
  /** Arabic name (transliterated) */
  name: string;
  /** English meaning */
  english: string;
  /** Number of ayāt in the surah */
  ayat: number;
};

export const SURAHS: Surah[] = [
  { n: 1, name: "Al-Fātiḥah", english: "The Opening", ayat: 7 },
  { n: 2, name: "Al-Baqarah", english: "The Cow", ayat: 286 },
  { n: 3, name: "Āl ʿImrān", english: "Family of Imran", ayat: 200 },
  { n: 4, name: "An-Nisāʾ", english: "The Women", ayat: 176 },
  { n: 5, name: "Al-Māʾidah", english: "The Table Spread", ayat: 120 },
  { n: 6, name: "Al-Anʿām", english: "The Cattle", ayat: 165 },
  { n: 7, name: "Al-Aʿrāf", english: "The Heights", ayat: 206 },
  { n: 8, name: "Al-Anfāl", english: "The Spoils", ayat: 75 },
  { n: 9, name: "At-Tawbah", english: "The Repentance", ayat: 129 },
  { n: 10, name: "Yūnus", english: "Jonah", ayat: 109 },
  { n: 11, name: "Hūd", english: "Hud", ayat: 123 },
  { n: 12, name: "Yūsuf", english: "Joseph", ayat: 111 },
  { n: 13, name: "Ar-Raʿd", english: "The Thunder", ayat: 43 },
  { n: 14, name: "Ibrāhīm", english: "Abraham", ayat: 52 },
  { n: 15, name: "Al-Ḥijr", english: "The Rocky Tract", ayat: 99 },
  { n: 16, name: "An-Naḥl", english: "The Bee", ayat: 128 },
  { n: 17, name: "Al-Isrāʾ", english: "The Night Journey", ayat: 111 },
  { n: 18, name: "Al-Kahf", english: "The Cave", ayat: 110 },
  { n: 19, name: "Maryam", english: "Mary", ayat: 98 },
  { n: 20, name: "Ṭā Hā", english: "Ta-Ha", ayat: 135 },
  { n: 21, name: "Al-Anbiyāʾ", english: "The Prophets", ayat: 112 },
  { n: 22, name: "Al-Ḥajj", english: "The Pilgrimage", ayat: 78 },
  { n: 23, name: "Al-Muʾminūn", english: "The Believers", ayat: 118 },
  { n: 24, name: "An-Nūr", english: "The Light", ayat: 64 },
  { n: 25, name: "Al-Furqān", english: "The Criterion", ayat: 77 },
  { n: 26, name: "Ash-Shuʿarāʾ", english: "The Poets", ayat: 227 },
  { n: 27, name: "An-Naml", english: "The Ants", ayat: 93 },
  { n: 28, name: "Al-Qaṣaṣ", english: "The Stories", ayat: 88 },
  { n: 29, name: "Al-ʿAnkabūt", english: "The Spider", ayat: 69 },
  { n: 30, name: "Ar-Rūm", english: "The Romans", ayat: 60 },
  { n: 31, name: "Luqmān", english: "Luqman", ayat: 34 },
  { n: 32, name: "As-Sajdah", english: "The Prostration", ayat: 30 },
  { n: 33, name: "Al-Aḥzāb", english: "The Confederates", ayat: 73 },
  { n: 34, name: "Sabaʾ", english: "Sheba", ayat: 54 },
  { n: 35, name: "Fāṭir", english: "Originator", ayat: 45 },
  { n: 36, name: "Yā Sīn", english: "Ya-Sin", ayat: 83 },
  { n: 37, name: "Aṣ-Ṣāffāt", english: "Those Ranged in Ranks", ayat: 182 },
  { n: 38, name: "Ṣād", english: "Sad", ayat: 88 },
  { n: 39, name: "Az-Zumar", english: "The Groups", ayat: 75 },
  { n: 40, name: "Ghāfir", english: "The Forgiver", ayat: 85 },
  { n: 41, name: "Fuṣṣilat", english: "Explained in Detail", ayat: 54 },
  { n: 42, name: "Ash-Shūrā", english: "Consultation", ayat: 53 },
  { n: 43, name: "Az-Zukhruf", english: "The Gold Adornments", ayat: 89 },
  { n: 44, name: "Ad-Dukhān", english: "The Smoke", ayat: 59 },
  { n: 45, name: "Al-Jāthiyah", english: "The Kneeling", ayat: 37 },
  { n: 46, name: "Al-Aḥqāf", english: "The Sand-Dunes", ayat: 35 },
  { n: 47, name: "Muḥammad", english: "Muhammad", ayat: 38 },
  { n: 48, name: "Al-Fatḥ", english: "The Victory", ayat: 29 },
  { n: 49, name: "Al-Ḥujurāt", english: "The Rooms", ayat: 18 },
  { n: 50, name: "Qāf", english: "Qaf", ayat: 45 },
  { n: 51, name: "Adh-Dhāriyāt", english: "The Scatterers", ayat: 60 },
  { n: 52, name: "Aṭ-Ṭūr", english: "The Mount", ayat: 49 },
  { n: 53, name: "An-Najm", english: "The Star", ayat: 62 },
  { n: 54, name: "Al-Qamar", english: "The Moon", ayat: 55 },
  { n: 55, name: "Ar-Raḥmān", english: "The Most Merciful", ayat: 78 },
  { n: 56, name: "Al-Wāqiʿah", english: "The Inevitable", ayat: 96 },
  { n: 57, name: "Al-Ḥadīd", english: "The Iron", ayat: 29 },
  { n: 58, name: "Al-Mujādilah", english: "The Pleading Woman", ayat: 22 },
  { n: 59, name: "Al-Ḥashr", english: "The Gathering", ayat: 24 },
  { n: 60, name: "Al-Mumtaḥanah", english: "The Examined One", ayat: 13 },
  { n: 61, name: "Aṣ-Ṣaff", english: "The Ranks", ayat: 14 },
  { n: 62, name: "Al-Jumuʿah", english: "Friday", ayat: 11 },
  { n: 63, name: "Al-Munāfiqūn", english: "The Hypocrites", ayat: 11 },
  { n: 64, name: "At-Taghābun", english: "Mutual Loss & Gain", ayat: 18 },
  { n: 65, name: "Aṭ-Ṭalāq", english: "The Divorce", ayat: 12 },
  { n: 66, name: "At-Taḥrīm", english: "The Prohibition", ayat: 12 },
  { n: 67, name: "Al-Mulk", english: "The Dominion", ayat: 30 },
  { n: 68, name: "Al-Qalam", english: "The Pen", ayat: 52 },
  { n: 69, name: "Al-Ḥāqqah", english: "The Reality", ayat: 52 },
  { n: 70, name: "Al-Maʿārij", english: "The Ascending Stairways", ayat: 44 },
  { n: 71, name: "Nūḥ", english: "Noah", ayat: 28 },
  { n: 72, name: "Al-Jinn", english: "The Jinn", ayat: 28 },
  { n: 73, name: "Al-Muzzammil", english: "The Enshrouded", ayat: 20 },
  { n: 74, name: "Al-Muddaththir", english: "The Cloaked", ayat: 56 },
  { n: 75, name: "Al-Qiyāmah", english: "The Resurrection", ayat: 40 },
  { n: 76, name: "Al-Insān", english: "Man", ayat: 31 },
  { n: 77, name: "Al-Mursalāt", english: "Those Sent Forth", ayat: 50 },
  { n: 78, name: "An-Nabaʾ", english: "The Tidings", ayat: 40 },
  { n: 79, name: "An-Nāziʿāt", english: "Those Who Pull Out", ayat: 46 },
  { n: 80, name: "ʿAbasa", english: "He Frowned", ayat: 42 },
  { n: 81, name: "At-Takwīr", english: "The Folding Up", ayat: 29 },
  { n: 82, name: "Al-Infiṭār", english: "The Cleaving", ayat: 19 },
  { n: 83, name: "Al-Muṭaffifīn", english: "Defrauding", ayat: 36 },
  { n: 84, name: "Al-Inshiqāq", english: "The Splitting Open", ayat: 25 },
  { n: 85, name: "Al-Burūj", english: "The Constellations", ayat: 22 },
  { n: 86, name: "Aṭ-Ṭāriq", english: "The Night-Comer", ayat: 17 },
  { n: 87, name: "Al-Aʿlā", english: "The Most High", ayat: 19 },
  { n: 88, name: "Al-Ghāshiyah", english: "The Overwhelming", ayat: 26 },
  { n: 89, name: "Al-Fajr", english: "The Dawn", ayat: 30 },
  { n: 90, name: "Al-Balad", english: "The City", ayat: 20 },
  { n: 91, name: "Ash-Shams", english: "The Sun", ayat: 15 },
  { n: 92, name: "Al-Layl", english: "The Night", ayat: 21 },
  { n: 93, name: "Aḍ-Ḍuḥā", english: "The Forenoon", ayat: 11 },
  { n: 94, name: "Ash-Sharḥ", english: "The Opening Forth", ayat: 8 },
  { n: 95, name: "At-Tīn", english: "The Fig", ayat: 8 },
  { n: 96, name: "Al-ʿAlaq", english: "The Clot", ayat: 19 },
  { n: 97, name: "Al-Qadr", english: "The Power", ayat: 5 },
  { n: 98, name: "Al-Bayyinah", english: "The Clear Evidence", ayat: 8 },
  { n: 99, name: "Az-Zalzalah", english: "The Earthquake", ayat: 8 },
  { n: 100, name: "Al-ʿĀdiyāt", english: "The Courser", ayat: 11 },
  { n: 101, name: "Al-Qāriʿah", english: "The Striking", ayat: 11 },
  { n: 102, name: "At-Takāthur", english: "The Piling Up", ayat: 8 },
  { n: 103, name: "Al-ʿAṣr", english: "Time", ayat: 3 },
  { n: 104, name: "Al-Humazah", english: "The Slanderer", ayat: 9 },
  { n: 105, name: "Al-Fīl", english: "The Elephant", ayat: 5 },
  { n: 106, name: "Quraysh", english: "Quraysh", ayat: 4 },
  { n: 107, name: "Al-Māʿūn", english: "Small Kindnesses", ayat: 7 },
  { n: 108, name: "Al-Kawthar", english: "Abundance", ayat: 3 },
  { n: 109, name: "Al-Kāfirūn", english: "The Disbelievers", ayat: 6 },
  { n: 110, name: "An-Naṣr", english: "The Help", ayat: 3 },
  { n: 111, name: "Al-Masad", english: "The Palm Fibre", ayat: 5 },
  { n: 112, name: "Al-Ikhlāṣ", english: "Sincerity", ayat: 4 },
  { n: 113, name: "Al-Falaq", english: "The Daybreak", ayat: 5 },
  { n: 114, name: "An-Nās", english: "Mankind", ayat: 6 },
];

// Juz boundary starts. Each entry is the (surah, ayah) where that Juz begins.
// Juz 30 ends at 114:6 (end of Mushaf).
export type JuzBoundary = { juz: number; surah: number; ayah: number };

export const JUZ_STARTS: JuzBoundary[] = [
  { juz: 1, surah: 1, ayah: 1 },
  { juz: 2, surah: 2, ayah: 142 },
  { juz: 3, surah: 2, ayah: 253 },
  { juz: 4, surah: 3, ayah: 93 },
  { juz: 5, surah: 4, ayah: 24 },
  { juz: 6, surah: 4, ayah: 148 },
  { juz: 7, surah: 5, ayah: 82 },
  { juz: 8, surah: 6, ayah: 111 },
  { juz: 9, surah: 7, ayah: 88 },
  { juz: 10, surah: 8, ayah: 41 },
  { juz: 11, surah: 9, ayah: 93 },
  { juz: 12, surah: 11, ayah: 6 },
  { juz: 13, surah: 12, ayah: 53 },
  { juz: 14, surah: 15, ayah: 1 },
  { juz: 15, surah: 17, ayah: 1 },
  { juz: 16, surah: 18, ayah: 75 },
  { juz: 17, surah: 21, ayah: 1 },
  { juz: 18, surah: 23, ayah: 1 },
  { juz: 19, surah: 25, ayah: 21 },
  { juz: 20, surah: 27, ayah: 56 },
  { juz: 21, surah: 29, ayah: 46 },
  { juz: 22, surah: 33, ayah: 31 },
  { juz: 23, surah: 36, ayah: 28 },
  { juz: 24, surah: 39, ayah: 32 },
  { juz: 25, surah: 41, ayah: 47 },
  { juz: 26, surah: 46, ayah: 1 },
  { juz: 27, surah: 51, ayah: 31 },
  { juz: 28, surah: 58, ayah: 1 },
  { juz: 29, surah: 67, ayah: 1 },
  { juz: 30, surah: 78, ayah: 1 },
];

export function getSurah(n: number): Surah | undefined {
  return SURAHS.find((s) => s.n === n);
}

// Compute the Juz containing (surah, ayah). Returns the juz number, or 1
// if the input is out-of-range.
export function juzForPosition(surah: number, ayah: number): number {
  let current = 1;
  for (const boundary of JUZ_STARTS) {
    if (
      boundary.surah < surah ||
      (boundary.surah === surah && boundary.ayah <= ayah)
    ) {
      current = boundary.juz;
    } else {
      break;
    }
  }
  return current;
}
