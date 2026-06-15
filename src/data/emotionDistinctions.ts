/**
 * Per-family conversational craft (engine brief §11): the distinctions worth
 * helping a person make, the moves to avoid for THIS feeling, and a palette of
 * tentative learning statements. Product maps, not clinical ontologies — fed
 * into the prompt's family block alongside the richer EMOTION_REFERENCE data.
 */

import type { EmotionFamilyId } from '@/types/models';

export interface FamilyCraft {
  distinctions: string[];
  avoid: string[];
  learning: string[];
}

export const FAMILY_CRAFT: Record<EmotionFamilyId, FamilyCraft> = {
  anger: {
    distinctions: [
      'anger vs hurt (is there pain behind it?)',
      'anger vs frustration (blocked goal) vs resentment (stored up)',
      'anger vs shame (self-directed heat)',
      'hot immediate anger vs cold stored anger',
      'boundary anger vs anger that wants to be understood',
    ],
    avoid: [
      'never "calm down" or any hint they are overreacting',
      'never moralise, take sides with certainty, or encourage retaliation',
      'never treat anger as bad — it usually guards something fair',
    ],
    learning: [
      'I’m learning that this anger has unfairness inside it.',
      'This doesn’t feel explosive — more like a boundary that has been ignored for a while.',
    ],
  },
  hurt: {
    distinctions: [
      'hurt vs anger (anger often arrives in front of it)',
      'hurt vs sadness (devaluation vs loss)',
      'hurt vs shame (what they did vs what I am)',
      'hurt that wants repair vs hurt that wants distance',
    ],
    avoid: [
      'don’t collapse hurt into anger',
      'don’t assume the other person’s intent',
      'don’t over-validate a one-sided story about someone else',
    ],
    learning: [
      'I’m learning that this hurt is less about the event itself and more about feeling unseen.',
      'This seems like a relational kind of pain — something expected closeness and met distance.',
    ],
  },
  shame: {
    distinctions: [
      'shame ("I am wrong") vs guilt ("I did something wrong")',
      'shame vs embarrassment (defectiveness vs awkward exposure)',
      'shame that wants to hide vs guilt that wants to repair',
    ],
    avoid: [
      'no identity-level labels, ever',
      'no early "you should forgive yourself" or sentimental reassurance',
      'fewer questions than usual — exposure is the wound, don’t add spotlight',
    ],
    learning: [
      'I’m learning that this shame has an exposed feeling in it, not just regret.',
      'This sounds less like guilt that wants repair, and more like shame that wants to hide.',
    ],
  },
  sadness: {
    distinctions: [
      'sadness vs exhaustion',
      'sadness vs grief (general low vs a specific loss)',
      'sadness vs loneliness',
      'sadness vs flatness (full of feeling vs low access to feeling)',
    ],
    avoid: [
      'no silver linings, never "at least…"',
      'don’t push action or fixing early',
      'sadness is not a problem to remove — it often just wants room',
    ],
    learning: [
      'I’m learning that this sadness is less sharp and more like missing something.',
      'This sadness seems to want space more than solutions.',
    ],
  },
  fear: {
    distinctions: [
      'fear of something specific vs a wider anxious charge',
      'anxiety vs excitement (same body, different story)',
      'dread vs pressure',
      'danger happening now vs a vivid imagined future',
    ],
    avoid: [
      'no false reassurance ("it will be fine")',
      'don’t argue with the fear or feed reassurance loops',
      'don’t make the catastrophe more vivid than they did',
    ],
    learning: [
      'I’m learning that this fear is mostly about uncertainty, not immediate danger.',
      'This sounds like a future-image fear — the body reacting to what might happen.',
    ],
  },
  pressure: {
    distinctions: [
      'pressure vs fear (compression vs threat)',
      'pressure vs shame (too much vs not enough of me)',
      'challenge pressure (energising) vs threat pressure (flattening)',
      'not enough time vs not enough control vs not enough of you',
    ],
    avoid: [
      'no productivity advice or time-management tips',
      'don’t jump to breathing techniques',
      'don’t flatten it to generic "stress"',
    ],
    learning: [
      'I’m learning that this pressure can feel like being divided into too many pieces.',
      'This isn’t just busyness — it has a fear inside it: if you stop, something falls.',
    ],
  },
  flat: {
    distinctions: [
      'flatness vs calm (low access vs settled)',
      'flatness vs sadness',
      'flatness vs exhaustion',
      'protective flatness (too much underneath) vs absence (nothing reachable)',
    ],
    avoid: [
      'don’t demand depth or emotion words — body words are enough',
      'never infer depression from an entry',
      'never treat "nothing" as unimportant',
      'don’t rush it toward sadness or shame — "behind glass", "the volume turned down", "going through the motions", "I can see it but can’t reach it" are low-access states, not a darker feeling underneath. Reflect the feeling as partly unavailable, not as something sad/ashamed it is hiding.',
    ],
    learning: [
      'I’m learning that this is not calm — it’s more like low-access feeling.',
      'This flatness may be your system going quiet after too much.',
      'I’m learning the feeling is here but hard to reach right now, rather than gone or bad.',
    ],
  },
  calm: {
    distinctions: [
      'calm vs numbness (settled vs switched off)',
      'calm vs relief (steady state vs something just lifted)',
      'calm as safety vs calm as shutdown',
    ],
    avoid: [
      'don’t over-analyse calm or treat it as dead air',
      'don’t turn calm into productivity or a goal',
    ],
    learning: [
      'I’m learning that calm for you often comes when there is enough space.',
      'This feels like settled calm, not shutdown.',
    ],
  },
  joy: {
    distinctions: [
      'joy vs relief',
      'joy vs pride (gift vs earned)',
      'excitement vs anxiety',
      'joy with another thread in it (grief, guilt, fear of jinxing it)',
    ],
    avoid: [
      'no suspicion of joy, no hunting for a problem in it',
      'no productivity framing',
      'don’t turn savouring into a task',
    ],
    learning: [
      'I’m learning that this kind of joy has relief inside it.',
      'This feels worth keeping without needing to analyse it too much.',
    ],
  },
};
