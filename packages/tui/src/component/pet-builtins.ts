import type { PetDefinition } from "./pet-model"

const frame = (...rows: string[]) => rows

const codex: PetDefinition = {
  palette: { b: "#4f7cff", d: "#2c4bb3", w: "#ffffff", k: "#101828" },
  states: {
    idle: [
      frame("..bbbb..", ".bbbbbb.", ".bwbbwb.", ".bbbbbb.", ".bbbbbb.", ".dddddd."),
      frame("..bbbb..", ".bbbbbb.", ".bwbbwb.", ".bbbbbb.", ".bbbbbb.", ".dddddd."),
      frame("..bbbb..", ".bbbbbb.", ".bbbbbb.", ".bbbbbb.", ".bbbbbb.", ".dddddd."),
      frame("..bbbb..", ".bbbbbb.", ".bwbbwb.", ".bbbbbb.", ".bbbbbb.", ".dddddd."),
      frame("..bbbb..", ".bbbbbb.", ".wbbwbb.", ".bbbbbb.", ".bbbbbb.", ".dddddd."),
      frame("..bbbb..", ".bbbbbb.", ".bwbbwb.", ".bbbbbb.", ".bbbbbb.", ".dddddd."),
      frame("..bbbb..", ".bbbbbb.", ".bbwbbw.", ".bbbbbb.", ".bbbbbb.", ".dddddd."),
      frame("........", "..bbbb..", ".bbbbbb.", ".bwbbwb.", ".bbbbbb.", ".bbbbbb."),
    ],
    think: [
      frame("..bbbb..", ".bwbbwb.", ".bbbbbb.", ".bbbbbb.", ".bbbbbb.", ".dddddd."),
      frame("..bbbb..", ".bwbbwb.", ".bbbbbb.", ".bbbbbb.", ".bbbbbb.", "..dddd.."),
    ],
    code: [
      frame("..bbbb..", ".bbbbbb.", ".bwbbwb.", ".bbbbbb.", ".bbbbbb.", "ddd.ddd."),
      frame("..bbbb..", ".bbbbbb.", ".bwbbwb.", ".bbbbbb.", ".bbbbbb.", ".ddd.ddd"),
    ],
    alert: [
      frame("..bbbb..", ".bbbbbb.", ".bwbbwb.", ".bbbbbb.", "..bkkb..", ".dddddd."),
      frame(".bbbbb..", "bbbbbb..", "bwbbwb..", "bbbbbb..", ".bkkb...", "dddddd.."),
    ],
  },
}

const hoots: PetDefinition = {
  palette: { b: "#b5651d", d: "#7a3f10", w: "#ffffff", k: "#2b1a0f", a: "#ff9f1c" },
  states: {
    idle: [
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", "bbbaabbb", ".bbbbbb."),
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", "bbbaabbb", ".bbbbbb."),
      frame(".bbbbbb.", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", "bbbaabbb", ".bbbbbb."),
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", "bbbaabbb", ".bbbbbb."),
      frame(".bbbbbb.", "bbbbbbbb", "wbbbbwbb", "bbbbbbbb", "bbbaabbb", ".bbbbbb."),
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", "bbbaabbb", ".bbbbbb."),
      frame(".bbbbbb.", "bbbbbbbb", "bbwbbwbb", "bbbbbbbb", "bbbaabbb", ".bbbbbb."),
      frame("........", ".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", "bbbaabbb"),
    ],
    think: [
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", "bbbaabbb", ".bbbbba."),
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", "bbbaabbb", ".bbbbbaa"),
    ],
    code: [
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb"),
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", "bbbbbbbb", "b.bbbb.b"),
    ],
    alert: [
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", ".bbkkbb.", ".bbbbbb."),
      frame(".bbbbbb.", "bbbbbbbb", "bwbbbbwb", "bbbbbbbb", ".bbkkbb.", "..bbbb.."),
    ],
  },
}

const bsod: PetDefinition = {
  palette: { k: "#3a3a3a", d: "#141414", b: "#2d6cdf", a: "#62d0ff", w: "#ffffff" },
  states: {
    idle: [
      frame("..kkkk..", ".kbbbbk.", ".kbwwbk.", ".kbbbbk.", ".kbbbbk.", "..kkkk.."),
      frame("..kkkk..", ".kbbbbk.", ".kbwwbk.", ".kbbbbk.", ".kbbbbk.", "..kkkk.."),
      frame("..kkkk..", ".kbbbbk.", ".kbbbbk.", ".kbbbbk.", ".kbbbbk.", "..kkkk.."),
      frame("..kkkk..", ".kbbbbk.", ".kbwwbk.", ".kbbbbk.", ".kbbbbk.", "..kkkk.."),
      frame("..kkkk..", ".kbbbbk.", ".kwbbwk.", ".kbbbbk.", ".kbbbbk.", "..kkkk.."),
      frame("..kkkk..", ".kbbbbk.", ".kbwwbk.", ".kbbbbk.", ".kbbbbk.", "..kkkk.."),
      frame("..kkkk..", ".kbbbbk.", ".kbbwwk.", ".kbbbbk.", ".kbbbbk.", "..kkkk.."),
      frame("........", "..kkkk..", ".kbbbbk.", ".kbwwbk.", ".kbbbbk.", ".kbbbbk."),
    ],
    think: [
      frame("...a....", "..kkkk..", ".kbbbbk.", ".kbwwbk.", ".kbbbbk.", "..kkkk.."),
      frame("....a...", "..kkkk..", ".kbbbbk.", ".kbwwbk.", ".kbbbbk.", "..kkkk.."),
    ],
    code: [
      frame("..kkkk..", ".kbbbbk.", ".kbwwbk.", ".kbbbbk.", ".kbbbbk.", ".k.kk.k."),
      frame("..kkkk..", ".kbbbbk.", ".kbwwbk.", ".kbbbbk.", ".kbbbbk.", ".k....k."),
    ],
    alert: [
      frame("..kkkk..", ".kbbbbk.", ".kbaabk.", ".kbbbbk.", ".kbbbbk.", "..kkkk.."),
      frame(".kkkk...", "kbbbbk..", "kbaabk..", "kbbbbk..", "kbbbbk..", ".kkkk..."),
    ],
  },
}

export const BUILTIN: Record<string, PetDefinition> = { codex, hoots, bsod }
export const BUILTIN_IDS = Object.keys(BUILTIN)
