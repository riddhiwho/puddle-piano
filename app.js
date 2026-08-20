const whiteNotes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5"];
const blackNotes = [
  ["C#4", "W", 1], ["D#4", "E", 2], ["F#4", "T", 4], ["G#4", "Y", 5], ["A#4", "U", 6], ["C#5", "O", 8], ["D#5", "P", 9]
];
const whiteKeys = ["A", "S", "D", "F", "G", "H", "J", "K", "L"];
const keyToIndex = Object.fromEntries([...whiteKeys.map((key, i) => [key, i]), ...blackNotes.map(([, key], i) => [key, `b${i}`])]);
const songs = [
  { name: "Twinkle, tiny star", notes: ["A","A","G","G","H","H","G","F","F","D","D","S","S","A"], message: "Follow each glowing key. Take your time!" },
  { name: "Raindrop hello", notes: ["A","S","D","S","A","S","D","G"], message: "A little raindrop song for the garden." },
  { name: "Frog's hop", notes: ["D","G","D","G","H","G","D","A"], message: "Help the frog hop from puddle to puddle!" },
  { name: "Mary had a little lamb", notes: ["D","S","A","S","D","D","D","S","S","S","D","G","G"], message: "A friendly little lamb is visiting the garden." },
  { name: "Ode to Joy", notes: ["D","D","F","G","G","F","D","S","A","A","S","D","D","S","S"], message: "A bright tune for a sunny puddle day." },
  { name: "Row, row, row your boat", notes: ["D","D","D","S","D","G","G","G","S","G","H","K","K","K","L","L","L","G","F","D","S","A"], message: "Row your tiny leaf boat across the puddle." },
  { name: "Frère Jacques", notes: ["A","S","D","A","A","S","D","A","D","F","G","D","F","G","G","H","G","F","D","A","G","H","G","F","D","A"], message: "A cheerful hello-and-echo song." },
  { name: "London Bridge", notes: ["G","H","G","F","D","F","G","S","A","S","D","F","D","F","G","H","G","F","D","A","G","F","D","S","A"], message: "Build a little leaf bridge over the water." },
  { name: "Old MacDonald", notes: ["G","G","G","D","D","D","G","H","H","G","F","F","D","A","A","G","G","D","D","D","G","H","H","G","F","F","D"], message: "The garden animals want to sing too." },
  { name: "Jingle Bells", notes: ["D","D","D","D","D","D","D","G","A","S","D","F","F","F","F","F","D","D","D","S","S","D","S","G"], message: "A sparkly winter tune, even in our sunny garden." },
  { name: "Yankee Doodle", notes: ["D","D","F","G","D","G","F","A","D","D","F","G","D","S","A","G","F","D","S","A","A","S","D","F","G","D","G","F","A"], message: "March through the garden with a very silly hat." },
  { name: "Rain, rain, go away", notes: ["G","D","G","G","D","G","G","D","H","G","F","D","S","A"], message: "A rainy-day song made for puddles." },
  { name: "Itsy Bitsy Spider", notes: ["G","G","G","A","H","H","H","A","G","A","H","K","K","K","H","G","A","H","H","H","A","G"], message: "Help a tiny spider climb up the water spout." }
];
let octave = 0, sustain = false, muted = false, songIndex = 0, songStep = -1, audioContext, demoTimers = [], celebrationTimer, audioResumePromise, fallbackAudio, fallbackUrl, previewRun = 0;
const activeVoices = new Map();
const maxActiveVoices = 24;
const piano = document.querySelector("#piano"), effects = document.querySelector("#effects"), guide = document.querySelector("#guide-text");
const noteOffsets = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 };
const frequencyFor = (note) => { const [, letter, sharp, octaveNumber] = note.match(/^([A-G])(#?)(\d)$/); return 440 * (2 ** ((noteOffsets[`${letter}${sharp}`] + (Number(octaveNumber) - 4) * 12 + octave * 12) / 12)); };
const noteFor = (index) => frequencyFor(whiteNotes[index]);
const blackNoteFor = (index) => frequencyFor(blackNotes[index][0]);

function buildPiano() {
  piano.innerHTML = "";
  whiteNotes.forEach((note, index) => {
    const key = document.createElement("button"); key.className = "key"; key.dataset.id = index; key.dataset.note = note; key.dataset.computer = whiteKeys[index];
    key.setAttribute("aria-label", `${note.replace(/\d/, "")} — computer key ${whiteKeys[index]}`);
    key.innerHTML = `<span class="key-label"><span>${note.replace(/\d/, "")}</span><kbd>${whiteKeys[index]}</kbd></span>`;
    wireKey(key, index, false); piano.append(key);
  });
  blackNotes.forEach(([note, computer, position], index) => {
    const key = document.createElement("button"); key.className = "black-key"; key.dataset.id = `b${index}`; key.dataset.note = note; key.dataset.computer = computer;
    key.style.left = `calc(var(--key-w) * ${position})`; key.setAttribute("aria-label", `${note.replace(/\d/, "")} — computer key ${computer}`);
    key.innerHTML = `<span class="key-label"><span>${note.replace(/\d/, "")}</span><kbd>${computer}</kbd></span>`;
    wireKey(key, index, true); piano.append(key);
  });
}
function wireKey(key, index, black) {
  const play = (event) => { event.preventDefault(); trigger(black ? blackNoteFor(index) : noteFor(index), key); };
  key.addEventListener("pointerdown", play); key.addEventListener("pointerup", () => release(key)); key.addEventListener("pointerleave", () => release(key)); key.addEventListener("pointercancel", () => release(key));
}
function readyAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext || audioContext.state === "closed") { audioContext = new AudioContextClass(); audioResumePromise = undefined; }
  resumeAudio(audioContext);
  return audioContext;
}
function resumeAudio(context) {
  if (!context || context.state === "closed") return Promise.resolve(false);
  if (context.state === "running") return Promise.resolve(true);
  if (!audioResumePromise) audioResumePromise = context.resume().then(() => context.state === "running").catch(() => false).finally(() => { audioResumePromise = undefined; });
  return audioResumePromise;
}
function playSafariFallback(frequency, duration = .72) {
  // Keep one native player alive. Mobile browsers limit simultaneous Audio
  // elements, which otherwise makes a few notes play and then fall silent.
  const sampleRate = 22050, frames = Math.floor(sampleRate * Math.min(Math.max(duration, .22), 1.1));
  const bytes = new ArrayBuffer(44 + frames * 2), view = new DataView(bytes);
  const write = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + frames * 2, true); write(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, frames * 2, true);
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / sampleRate, envelope = Math.exp(-4.3 * frame / frames);
    const sample = (Math.sin(Math.PI * 2 * frequency * time) * .72 + Math.sin(Math.PI * 2 * frequency * 2 * time) * .18 + Math.sin(Math.PI * 2 * frequency * 3.01 * time) * .07) * envelope;
    view.setInt16(44 + frame * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }
  const url = URL.createObjectURL(new Blob([bytes], { type:"audio/wav" }));
  if (!fallbackAudio) fallbackAudio = new Audio();
  fallbackAudio.pause();
  if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
  fallbackUrl = url;
  const note = fallbackAudio;
  note.src = url;
  note.volume = .35;
  note.onended = () => { if (fallbackUrl === url) { URL.revokeObjectURL(url); fallbackUrl = undefined; } };
  note.play().catch(() => { if (fallbackUrl === url) { URL.revokeObjectURL(url); fallbackUrl = undefined; } });
}
function playPiano(frequency, id, duration = 0) {
  const context = readyAudio();
  if (!context || context.state !== "running") { playSafariFallback(frequency, duration || .72); return; }
  releasePiano(id);
  while (activeVoices.size >= maxActiveVoices) releasePiano(activeVoices.keys().next().value);
  const gain = context.createGain(); gain.connect(context.destination); gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.22, context.currentTime + .018); gain.gain.exponentialRampToValueAtTime(.075, context.currentTime + .22);
  const oscillators = [["sine", 1, .72], ["triangle", 2, .16], ["sine", 3.01, .07]].map(([type, multiplier, volume]) => { const oscillator = context.createOscillator(); const partialGain = context.createGain(); oscillator.type = type; oscillator.frequency.value = frequency * multiplier; partialGain.gain.value = volume; oscillator.connect(partialGain).connect(gain); oscillator.start(); return oscillator; });
  const voice = { gain, oscillators };
  activeVoices.set(id, voice);
  // Only release this exact voice. A cancelled/restarted song preview may reuse
  // its id before an older duration timer gets a chance to run.
  if (duration) setTimeout(() => { if (activeVoices.get(id) === voice) releasePiano(id); }, duration * 1000);
}
function releasePiano(id) {
  const voice = activeVoices.get(id);
  if (!voice || !audioContext) return;
  activeVoices.delete(id);
  const end = audioContext.currentTime + .35;
  voice.gain.gain.cancelScheduledValues(audioContext.currentTime);
  voice.gain.gain.setValueAtTime(Math.max(.0001, voice.gain.gain.value), audioContext.currentTime);
  voice.gain.gain.exponentialRampToValueAtTime(.0001, end);
  voice.oscillators.forEach(oscillator => oscillator.stop(end + .02));
  setTimeout(() => { voice.oscillators.forEach(oscillator => oscillator.disconnect()); voice.gain.disconnect(); }, 450);
}
function releaseAllPiano() { [...activeVoices.keys()].forEach(releasePiano); }
function trigger(note, key) {
  if (!muted) playPiano(note, key.dataset.id);
  key.classList.add("active"); gardenEffect(key); guide.textContent = songStep >= 0 ? "Lovely! Keep following the fireflies." : ["What a lovely note!", "The puddle heard you!", "The flowers are listening!", "That made a little ripple!"][Math.floor(Math.random()*4)];
  const expected = songStep >= 0 && songs[songIndex].notes[songStep];
  if (expected && key.dataset.computer === expected) { songStep++; if (songStep >= songs[songIndex].notes.length) { guide.textContent = "You made a melody! The garden is cheering."; songStep = -1; document.querySelector("#song-prompt").textContent = "A whole tiny tune! Pick another one or make your own music."; celebrateSong(); } updateSongGlow(); }
}
function release(key) { if (!sustain) releasePiano(key.dataset.id); key.classList.remove("active"); }
function gardenEffect(key) { const rect = key.getBoundingClientRect(); ["ripple", "petal", "petal"].forEach((type, i) => { const el=document.createElement("span"); el.className=type; el.style.left=`${rect.left+rect.width/2+(i-1)*10}px`; el.style.top=`${rect.bottom-25}px`; if(type === "petal") { el.textContent=i===1?"✦":"❀"; el.style.setProperty("--x",`${(i-1)*26}px`); } effects.append(el); setTimeout(()=>el.remove(),1000); }); }
function updateSongGlow() { document.querySelectorAll(".song-next").forEach(el=>el.classList.remove("song-next")); if (songStep < 0) return; const next=songs[songIndex].notes[songStep]; document.querySelector(`[data-computer="${next}"]`)?.classList.add("song-next"); }
function chooseSong(delta=0) { songIndex = (songIndex + delta + songs.length) % songs.length; songStep = -1; document.querySelector("#song-name").textContent=songs[songIndex].name; document.querySelector("#song-listen").setAttribute("aria-label",`Listen to ${songs[songIndex].name}`); document.querySelector("#song-start").textContent="start tune"; document.querySelector("#song-prompt").textContent=songs[songIndex].message; updateSongGlow(); }
function celebrateSong() { const celebration = document.querySelector("#celebration"); clearTimeout(celebrationTimer); celebration.classList.remove("show"); void celebration.offsetWidth; celebration.classList.add("show"); celebration.setAttribute("aria-hidden", "false"); celebrationTimer = setTimeout(() => { celebration.classList.remove("show"); celebration.setAttribute("aria-hidden", "true"); }, 2800); }
async function playTunePreview() {
  const run = ++previewRun;
  demoTimers.forEach(clearTimeout); demoTimers = [];
  const button = document.querySelector("#song-listen"); button.classList.add("playing"); button.textContent = "♫";
  const context = readyAudio(); if (muted) { button.classList.remove("playing"); button.textContent = "🔊"; return; }
  // Preview notes are scheduled after this click. Wait until the click has
  // genuinely unlocked audio so iOS Safari and mobile Chrome permit them.
  if (!(await resumeAudio(context)) || run !== previewRun) { if (run === previewRun) { button.classList.remove("playing"); button.textContent = "🔊"; guide.textContent = "Tap a piano key once, then try the speaker again."; } return; }
  songStep = -1; updateSongGlow();
  const pace = .82;
  songs[songIndex].notes.forEach((computer, index) => {
    const key = document.querySelector(`[data-computer="${computer}"]`); const mapped = keyToIndex[computer];
    const note = typeof mapped === "string" ? blackNoteFor(Number(mapped.slice(1))) : noteFor(mapped);
    const demoId = `demo-${index}`;
    demoTimers.push(setTimeout(() => { playPiano(note, demoId, .58); key?.classList.add("active"); if (key) gardenEffect(key); }, index * pace * 1000));
    demoTimers.push(setTimeout(() => key?.classList.remove("active"), (index * pace + .58) * 1000));
  });
  demoTimers.push(setTimeout(() => { button.classList.remove("playing"); button.textContent = "🔊"; guide.textContent = "Now it’s your turn to make a ripple!"; }, songs[songIndex].notes.length * pace * 1000 + 180));
}
document.addEventListener("pointerdown", () => { resumeAudio(readyAudio()); }, { capture:true, passive:true });
document.addEventListener("keydown", () => { resumeAudio(readyAudio()); }, { capture:true });
document.addEventListener("keydown", (event) => { if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; const key=event.key.toUpperCase(); const id=keyToIndex[key]; if(id === undefined) return; event.preventDefault(); const el=document.querySelector(`[data-id="${id}"]`); if(el) trigger(typeof id === "string" ? blackNoteFor(Number(id.slice(1))) : noteFor(id), el); });
document.addEventListener("keyup", (event) => { const key=event.key.toUpperCase(); const id=keyToIndex[key]; if(id === undefined) return; const el=document.querySelector(`[data-id="${id}"]`); if(el) release(el); });
// Browsers do not always send keyup when the tab/app loses focus. Release those
// notes so a lost key press cannot leave a voice running indefinitely.
window.addEventListener("blur", () => { if (!sustain) releaseAllPiano(); document.querySelectorAll(".key.active, .black-key.active").forEach(key => key.classList.remove("active")); });
document.querySelector("#song-prev").addEventListener("click",()=>chooseSong(-1)); document.querySelector("#song-next").addEventListener("click",()=>chooseSong(1));
document.querySelector("#song-listen").addEventListener("click",playTunePreview);
document.querySelector("#song-start").addEventListener("click",()=>{ songStep=0; document.querySelector("#song-prompt").textContent="Press the glowing key to begin!"; updateSongGlow(); readyAudio(); });
document.querySelector("#octave-down").addEventListener("click",()=>{ octave=Math.max(-1,octave-1); document.querySelector("#octave-label").textContent=octave===0?"middle notes":"lower notes"; });
document.querySelector("#octave-up").addEventListener("click",()=>{ octave=Math.min(1,octave+1); document.querySelector("#octave-label").textContent=octave===0?"middle notes":"higher notes"; });
document.querySelector("#sustain-toggle").addEventListener("click",(e)=>{ sustain=!sustain;e.currentTarget.setAttribute("aria-pressed",sustain); if(!sustain) releaseAllPiano(); });
document.querySelector("#sound-toggle").addEventListener("click",(e)=>{ muted=!muted;e.currentTarget.setAttribute("aria-pressed",muted);e.currentTarget.innerHTML=muted?"◌ <span>muted</span>":"♬ <span>sound</span>"; if(muted) releaseAllPiano(); });
document.querySelector("#motion-toggle").addEventListener("click",(e)=>{ const reduced=document.body.classList.toggle("reduce-motion");e.currentTarget.setAttribute("aria-pressed",reduced); });
buildPiano(); chooseSong();
