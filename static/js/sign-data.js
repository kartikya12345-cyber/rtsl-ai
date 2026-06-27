// Image path convention: reference/asl_{letter}.png for alphabet, reference/gesture_{id}.png for Keras gestures

const HAND_POSES = (() => {
  const C = 0, E = 1, H = 2, T = 3;
  return {
    A: { thumb: C, index: C, middle: C, ring: C, pinky: C, txt: 'Fist — thumb on index' },
    B: { thumb: T, index: E, middle: E, ring: E, pinky: E, txt: 'All fingers up, thumb across palm' },
    C: { thumb: H, index: H, middle: H, ring: H, pinky: H, txt: 'Curved C shape' },
    D: { thumb: C, index: E, middle: C, ring: C, pinky: C, txt: 'Index up, rest in fist' },
    E: { thumb: C, index: C, middle: C, ring: C, pinky: C, txt: 'All curled, thumb touches fingertips' },
    F: { thumb: E, index: H, middle: E, ring: E, pinky: E, txt: 'Circle with thumb+index, others up' },
    G: { thumb: E, index: E, middle: C, ring: C, pinky: C, txt: 'Index+thumb forward, fist otherwise' },
    H: { thumb: C, index: E, middle: E, ring: C, pinky: C, txt: 'Index+middle extended together' },
    I: { thumb: C, index: C, middle: C, ring: C, pinky: E, txt: 'Pinky up, rest in fist' },
    J: { thumb: C, index: C, middle: C, ring: C, pinky: H, txt: 'Pinky up curved, tracing J' },
    K: { thumb: E, index: E, middle: E, ring: C, pinky: C, txt: 'Index+middle up, thumb between' },
    L: { thumb: E, index: E, middle: C, ring: C, pinky: C, txt: 'L shape — index+thumb out' },
    M: { thumb: C, index: C, middle: C, ring: C, pinky: C, txt: 'All curled, thumb over fingers' },
    N: { thumb: C, index: C, middle: C, ring: C, pinky: C, txt: 'All curled, thumb between M+R' },
    O: { thumb: H, index: H, middle: H, ring: H, pinky: H, txt: 'All fingertips touch in O' },
    P: { thumb: E, index: E, middle: E, ring: C, pinky: C, txt: 'Index forward, thumb on middle' },
    Q: { thumb: E, index: E, middle: C, ring: C, pinky: C, txt: 'Index+thumb down, hand angled' },
    R: { thumb: C, index: E, middle: E, ring: C, pinky: C, txt: 'Index+middle crossed' },
    S: { thumb: C, index: C, middle: C, ring: C, pinky: C, txt: 'Fist, thumb over fingers' },
    T: { thumb: C, index: C, middle: C, ring: C, pinky: C, txt: 'Thumb between index+middle' },
    U: { thumb: C, index: E, middle: E, ring: C, pinky: C, txt: 'Index+middle up together' },
    V: { thumb: C, index: E, middle: E, ring: C, pinky: C, txt: 'Peace sign V' },
    W: { thumb: C, index: E, middle: E, ring: E, pinky: C, txt: 'Three fingers spread' },
    X: { thumb: C, index: H, middle: C, ring: C, pinky: C, txt: 'Index hooked, rest in fist' },
    Y: { thumb: E, index: C, middle: C, ring: C, pinky: E, txt: 'Thumb+pinky out, rest fist' },
    Z: { thumb: C, index: E, middle: C, ring: C, pinky: C, txt: 'Index traces Z in air' },
  };
})();

const KERAS_GESTURES = [
  { id: 'hello',      label: 'Hello',        desc: 'Wave your open hand side to side, palm facing forward.' },
  { id: 'thanks',     label: 'Thanks',       desc: 'Touch your chin or lips with your open palm and move it forward.' },
  { id: 'yes',        label: 'Yes',          desc: 'Make a fist and nod it up and down like a head nodding.' },
  { id: 'no',         label: 'No',           desc: 'Extend thumb, index, and middle fingers together and close to thumb.' },
  { id: 'please',     label: 'Please',       desc: 'Place your open hand on your chest and move it in a circular motion.' },
  { id: 'sorry',      label: 'Sorry',        desc: 'Make a fist and rub it in a circle over your chest.' },
  { id: 'help',       label: 'Help',         desc: 'Place one open hand on top of the other, palm up, and lift together.' },
  { id: 'good',       label: 'Good',         desc: 'Touch your chin with your open hand and move it forward and down.' },
  { id: 'bad',        label: 'Bad',          desc: 'Touch your chin with the back of your hand and flick it forward.' },
  { id: 'stop',       label: 'Stop',         desc: 'Hold your open hand up with palm facing forward, like a stop sign.' },
  { id: 'eat',        label: 'Eat',          desc: 'Bring your hand to your mouth as if holding food.' },
  { id: 'drink',      label: 'Drink',        desc: 'Form a C shape with your hand and bring it to your mouth.' },
  { id: 'read',       label: 'Read',         desc: 'Hold your open hand out, palm up, as if holding a book.' },
  { id: 'write',      label: 'Write',        desc: 'Pinch your thumb and index together and move as if writing.' },
  { id: 'play',       label: 'Play',         desc: 'Wiggle your open hands with palms facing down at waist level.' },
  { id: 'love',       label: 'Love You',     desc: 'Extend thumb, index, and pinky — the ILY sign.' },
  { id: 'monday',     label: 'Monday',       desc: 'Form an M and rotate it forward.' },
  { id: 'tuesday',    label: 'Tuesday',      desc: 'Form a T and rotate it forward.' },
  { id: 'wednesday',  label: 'Wednesday',    desc: 'Form a W and rotate it forward.' },
  { id: 'thursday',   label: 'Thursday',     desc: 'Form a T and rotate it forward (different motion).' },
  { id: 'friday',     label: 'Friday',       desc: 'Form an F and rotate it forward.' },
  { id: 'saturday',   label: 'Saturday',     desc: 'Form an S and rotate it forward.' },
  { id: 'sunday',     label: 'Sunday',       desc: 'Open hand with palm up, move in an arc.' },
  { id: '0',          label: '0',            desc: 'Form an O shape with all fingers touching the thumb.' },
  { id: '1',          label: '1',            desc: 'Index finger up, rest in a fist.' },
  { id: '2',          label: '2',            desc: 'Index and middle fingers up, rest in a fist.' },
  { id: '3',          label: '3',            desc: 'Thumb, index, and middle fingers extended, rest curled.' },
  { id: '4',          label: '4',            desc: 'Four fingers extended, thumb tucked into palm.' },
  { id: '5',          label: '5',            desc: 'All five fingers spread open.' },
  { id: '6',          label: '6',            desc: 'Thumb and pinky touch, other fingers spread.' },
  { id: '7',          label: '7',            desc: 'Thumb touches ring finger, other fingers spread.' },
  { id: '8',          label: '8',            desc: 'Thumb touches middle finger, other fingers spread.' },
  { id: '9',          label: '9',            desc: 'Thumb touches index finger, other fingers spread.' },
  { id: '10',         label: '10',           desc: 'Index fingers crossed or thumbs up gesture.' },
];

const ASL_CATEGORIES = [
  { id: 'all', label: 'All Letters' },
  { id: 'vowels', label: 'Vowels' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

function getLetterDifficulty(letter) {
  const easy = 'ABCDFILOHSVY';
  const medium = 'EGHJKRTUWZ';
  if (easy.includes(letter)) return 'easy';
  if (medium.includes(letter)) return 'medium';
  return 'hard';
}

function getLetterDescription(letter) {
  const p = HAND_POSES[letter];
  if (!p) return '';
  const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
  const states = ['curled into palm', 'extended straight', 'half bent', 'across palm'];
  const parts = [];
  const vals = [p.thumb, p.index, p.middle, p.ring, p.pinky];
  vals.forEach((v, i) => {
    if (i === 0 && v === 3) { parts.push('Thumb folded across palm'); return; }
    if (v > 0) parts.push(`${fingerNames[i]} ${states[v]}`);
  });
  return parts.join('. ') + '.';
}
