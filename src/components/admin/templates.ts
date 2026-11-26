import type { GameContent, GameKind } from '../games/types';
import { toMorse } from '../games/morseCode';
import { EXAMPLE_SUSPECTS } from '../games/suspectsLogic';
import { EXAMPLE_EINSTEIN, EXAMPLE_STORY } from '../games/einsteinLogic';

/** A ready-made example quest. Loads into the editor; the gift is left for the creator to write. */
export interface QuestTemplate {
  id: string;
  label: string;
  title: string;
  kind: GameKind;
  content: GameContent;
  answers: string[];
  hint?: string;
}

export const TEMPLATES: QuestTemplate[] = [
  {
    id: 'riddle',
    label: '❓ Riddle: the frosty one',
    title: 'The frosty riddle',
    kind: 'riddle',
    content: { prompt: 'I have a carrot for a nose, coal for eyes, and I’m gone by spring. What am I?' },
    answers: ['snowman', 'a snowman'],
    hint: 'You build me in the garden ⛄',
  },
  {
    id: 'wordle',
    label: '🟩 Wordle: word of the season',
    title: 'Word of the day',
    kind: 'wordle',
    content: { prompt: 'A word you’ll hear a lot this month', length: 5 },
    answers: ['MERRY'],
    hint: '“___ Christmas!”',
  },
  {
    id: 'emoji',
    label: '😀 Emoji riddle: guess the film',
    title: 'Guess the Christmas film',
    kind: 'emoji',
    content: { prompt: 'Which Christmas film is this?', emojis: '🏠🎄👦🪤🧳', emojiHints: ['✈️👨‍👩‍👧‍👦', '😈😈'] },
    answers: ['Home Alone'],
  },
  {
    id: 'anagram',
    label: '🔤 Anagram: a winter drink',
    title: 'Scrambled treat',
    kind: 'anagram',
    content: { prompt: 'Unscramble a warm winter drink', letters: 'OACOC' },
    answers: ['cocoa'],
    hint: 'Best with marshmallows',
  },
  {
    id: 'hangman',
    label: '⛄ Hangman: top of the tree',
    title: 'Save the snowman',
    kind: 'hangman',
    content: { prompt: 'What goes on top of the Christmas tree?', mask: '____' },
    answers: ['star'],
  },
  {
    id: 'cipher',
    label: '🔐 Cipher wheel: elf message',
    title: 'A message from the elves',
    kind: 'cipher',
    content: { prompt: 'The elves left a coded message. Turn the wheel to read it.', cipher: 'ORRN XQGHU WKH WUHH' },
    answers: ['Look under the tree'],
  },
  {
    id: 'morse',
    label: '💡 Morse lights: blinking bulb',
    title: 'Blinking lights',
    kind: 'morse',
    content: { prompt: 'The lights are trying to tell you something…', morse: toMorse('Snow') },
    answers: ['Snow'],
    hint: 'It falls from the sky in winter',
  },
  {
    id: 'quiz',
    label: '📝 Quiz: how well do you know me?',
    title: 'How well do you know me?',
    kind: 'quiz',
    content: {
      prompt: 'Change these to questions about you!',
      questions: [
        { q: 'My favourite Christmas song?', options: ['Last Christmas', 'All I Want for Christmas Is You', 'Jingle Bell Rock'] },
        { q: 'What I’d eat all December?', options: ['Gingerbread', 'Mince pies', 'Chocolate'] },
        { q: 'My dream Christmas trip?', options: ['Lapland', 'New York', 'Vienna markets'] },
      ],
    },
    answers: ['1,0,0'],
  },
  {
    id: 'timeline',
    label: '📅 Timeline: our story',
    title: 'Our story',
    kind: 'timeline',
    content: {
      prompt: 'Put our moments in the right order',
      items: [
        { id: 'b', text: 'Our first trip together' },
        { id: 'c', text: 'Our first Christmas' },
        { id: 'a', text: 'The day we met' },
      ],
    },
    answers: ['a,b,c'],
  },
  {
    id: 'truths',
    label: '🤥 Two truths and a lie',
    title: 'Two truths and a lie',
    kind: 'truths',
    content: {
      prompt: 'Change these to facts about you! One in each round is a lie.',
      rounds: [
        { statements: ['I once ate a whole cake by myself', 'I’ve been to Lapland', 'I can’t whistle'] },
        { statements: ['My first pet was a hamster', 'I’ve never seen a snowball fight', 'I cried at Love Actually'] },
      ],
    },
    answers: ['1,1'],
  },
  {
    id: 'suspects',
    label: '🔎 The four suspects: who did it?',
    title: 'Who ate the cookies?',
    kind: 'suspects',
    content: { prompt: 'Someone ate the last gingerbread cookie 🍪 Four suspects, four statements…', suspects: EXAMPLE_SUSPECTS },
    answers: ['2'],
    hint: 'Try each suspect as the culprit and count the true statements',
  },
  {
    id: 'einstein',
    label: '🗝️ Einstein puzzle: the Golden Christmas Key',
    title: 'The Golden Christmas Key',
    kind: 'einstein',
    content: { prompt: EXAMPLE_STORY, einstein: EXAMPLE_EINSTEIN },
    answers: ['2'],
    hint: 'Start with the drinks: three rooms are tied to a drink, so the fourth room gets the last one\nThe person drinking hot chocolate has the key\nWho drinks hot chocolate?',
  },
  {
    id: 'wavelength',
    label: '🎚️ Wavelength: naughty or nice?',
    title: 'Same wavelength?',
    kind: 'wavelength',
    content: { prompt: 'Are we on the same wavelength? 📻', spectrum: { left: 'Naughty', right: 'Nice', clue: 'Me this year 😇' } },
    answers: ['78,7'],
    hint: 'I think you’ve been more nice than naughty…\nDefinitely on the nice side\nAlmost as nice as it gets',
  },
  {
    id: 'map',
    label: '📍 Map pin: Santa’s village',
    title: 'Where does Santa live?',
    kind: 'map',
    content: { prompt: 'Drop a pin on Santa Claus Village in Finland 🎅', center: [55, 15], zoom: 3 },
    answers: ['66.5436,25.8473,30000'],
    hint: 'Right on the Arctic Circle, in Lapland',
  },
  {
    id: 'treasure',
    label: '🗺️ Treasure hunt: fridge clue',
    title: 'Treasure hunt',
    kind: 'treasure',
    content: { prompt: 'Where the cold things sleep, behind the milk… 🧊 Find the code!' },
    answers: ['NORTHPOLE'],
    hint: 'Open the fridge',
  },
  {
    id: 'chain',
    label: '🔗 Chain: riddle → emoji film',
    title: 'Double challenge',
    kind: 'chain',
    content: {
      prompt: 'Two challenges stand between you and today’s gift…',
      parts: [
        { kind: 'riddle', content: { prompt: 'What has to be broken before you can use it?' } },
        { kind: 'emoji', content: { prompt: 'Now name this film', emojis: '🧝‍♂️🎄🗽🍝' } },
      ],
    },
    answers: [JSON.stringify(['egg', 'an egg']), JSON.stringify(['Elf'])],
  },
];
