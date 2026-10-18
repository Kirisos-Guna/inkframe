import type { StyleDef } from './types'

export const BUILTIN_STYLES: StyleDef[] = [
  {
    id: 'hand-drawn-board', name: 'Hand-drawn Board', tags: ['Whiteboard', 'Explainer'], dim: '2D',
    description: 'A pen draws your story on a dark board, in sync with every word.',
    palette: { bg: '#07080a', ink: '#f2f2f2', accent: '#f5a623' }, stroke: { width: 3, jitter: 0.6, texture: 'pen' }
  },
  {
    id: 'notebook-sketch', name: 'Notebook Sketch', tags: ['Marker', 'Notebook'], dim: '2D',
    description: 'Marker drawings and handwriting on lined notebook paper.',
    palette: { bg: '#fbfaf5', ink: '#1d1d1f', accent: '#e8553d', paper: '#cfd8e8' }, stroke: { width: 4, jitter: 0.8, texture: 'marker' }
  },
  {
    id: 'chalkboard', name: 'Chalkboard', tags: ['Chalk', 'Classroom'], dim: '2D',
    description: 'Classroom chalk on a slate board, wiped and redrawn.',
    palette: { bg: '#1f2a26', ink: '#eaeee6', accent: '#f0d264' }, stroke: { width: 4, jitter: 1.2, texture: 'chalk' }
  },
  {
    id: 'pencil-sketch', name: 'Pencil Sketch', tags: ['Pencil', 'Graphite'], dim: '2D',
    description: 'Soft graphite drawings and shading on cream paper.',
    palette: { bg: '#efeadf', ink: '#4a4a4a', accent: '#8a8a8a' }, stroke: { width: 2, jitter: 1, texture: 'pencil' }
  },
  {
    id: 'risograph', name: 'Risograph Print', tags: ['Print', 'Halftone'], dim: '2D',
    description: 'Bold inks roll onto paper as halftone dots, slightly out of register.',
    palette: { bg: '#f1ece2', ink: '#1a7f86', accent: '#ff5a36' }, stroke: { width: 3, jitter: 0.3, texture: 'none' }
  },
  {
    id: 'sumi-ink', name: 'Sumi Ink', tags: ['Ink', 'Brush'], dim: '2D',
    description: 'Brush strokes and ink drops that bloom and soak into rice paper.',
    palette: { bg: '#f3f0e8', ink: '#141414', accent: '#b0302a' }, stroke: { width: 8, jitter: 1.4, texture: 'brush' }
  },
  {
    id: 'paper-cutout', name: 'Paper Cut-out', tags: ['Papercraft', 'Stop-motion'], dim: '2D',
    description: 'Torn-edge paper shapes with real shadows, animated on twos.',
    palette: { bg: '#f2b632', ink: '#1b1b1b', accent: '#ef5a2a' }, stroke: { width: 0, jitter: 0, texture: 'none' }
  },
  {
    id: 'blueprint', name: 'Blueprint', tags: ['Technical', 'Isometric'], dim: '2D',
    description: 'Isometric drawings drafted live in white line on a cobalt grid.',
    palette: { bg: '#1747b8', ink: '#e8f0ff', accent: '#9fd0ff' }, stroke: { width: 2, jitter: 0, texture: 'pen' }
  },
  {
    id: 'engraving', name: 'Banknote Engraving', tags: ['Engraved', 'Money'], dim: '2D',
    description: 'Fine engraved lines and guilloche patterns, like the art on a banknote.',
    palette: { bg: '#e4ead9', ink: '#2c4a3a', accent: '#7a8f5d' }, stroke: { width: 1.2, jitter: 0, texture: 'pen' }
  },
  {
    id: 'cartoon-history', name: 'Cartoon History', tags: ['Cartoon', 'Theatre'], dim: '2D',
    description: 'Flat cartoon scenes on a stage, framed like a history lesson.',
    palette: { bg: '#24324a', ink: '#f6e7c8', accent: '#c8372d' }, stroke: { width: 3, jitter: 0.2, texture: 'none' }
  },
  {
    id: 'neon-ledger', name: 'Neon Ledger', tags: ['Neon', 'Data'], dim: '2D',
    description: 'Glowing lines and numbers on deep black, for money and growth stories.',
    palette: { bg: '#05060a', ink: '#e9fbff', accent: '#33e1a1' }, stroke: { width: 2.5, jitter: 0, texture: 'pen' }
  },
  {
    id: 'watercolour', name: 'Watercolour', tags: ['Paint', 'Soft'], dim: '2D',
    description: 'Washes of colour bleed into textured paper behind fine ink lines.',
    palette: { bg: '#f6f2ea', ink: '#2e3a46', accent: '#5b8fc7' }, stroke: { width: 2, jitter: 0.5, texture: 'brush' }
  },
  {
    id: 'flat-cartoon', name: 'Flat Cartoon', tags: ['Cartoon', 'Characters'], dim: '2D',
    description: 'Bold outlines and flat colours, with characters that act out the story.',
    palette: { bg: '#8fd3f4', ink: '#1b1b22', accent: '#ff5d73' }, stroke: { width: 4, jitter: 0.1, texture: 'none' }
  },
  {
    id: 'cinematic-3d', name: 'Cinematic 3D', tags: ['3D', 'Lit'], dim: '3D',
    description: 'Lit, shaded objects floating in a dark space, with slow camera moves.',
    palette: { bg: '#0b0f1a', ink: '#e8eefc', accent: '#7cc4ff' }, stroke: { width: 0, jitter: 0, texture: 'none' }
  },
  {
    id: 'short-3d', name: 'Quick Facts 3D', tags: ['3D', 'Fast'], dim: '3D',
    description: 'Glossy 3D close-ups that change every couple of seconds, made for fast facts.',
    palette: { bg: '#1a1410', ink: '#fff4e6', accent: '#ffb547' }, stroke: { width: 0, jitter: 0, texture: 'none' }
  },
  {
    id: 'soft-3d', name: 'Soft 3D', tags: ['Clay', 'Rounded'], dim: '3D',
    description: 'Rounded, soft-lit 3D shapes in pastel colours, like a toy box.',
    palette: { bg: '#e9e4f5', ink: '#3b3561', accent: '#ff7aa2' }, stroke: { width: 0, jitter: 0, texture: 'none' }
  },
  {
    id: 'isometric-3d', name: 'Isometric City', tags: ['Isometric', 'Low-poly'], dim: '3D',
    description: 'A tiny isometric world that builds itself block by block.',
    palette: { bg: '#0f1626', ink: '#e6edf7', accent: '#4f9cff' }, stroke: { width: 0, jitter: 0, texture: 'none' }
  }
]

export const SHOWPIECES = [
  { id: 'big-number', name: 'Big number', description: 'One number fills the screen and counts up to the word.' },
  { id: 'map-zoom', name: 'Map zoom', description: 'Fly from the whole planet down to one street.' },
  { id: 'globe-trip', name: 'Globe trip', description: 'A line travels around a spinning globe.' },
  { id: 'typewriter', name: 'Typewriter title', description: 'The key sentence types itself, letter by letter.' },
  { id: 'split-screen', name: 'Split screen', description: 'Before and after, side by side.' },
  { id: 'chart-build', name: 'Chart build', description: 'Bars and lines draw in as the numbers are said.' }
]
