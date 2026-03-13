import * as Tone from "tone";

export interface EffectsChainNodes {
  compressor: Tone.Compressor;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
}

export function createEffectsChain(destination: Tone.Gain): EffectsChainNodes {
  const compressor = new Tone.Compressor({
    threshold: -24,
    ratio: 3,
  });

  const delay = new Tone.FeedbackDelay("8n", 0.3);

  const reverb = new Tone.Reverb({
    decay: 3,
    wet: 0.3,
  });

  compressor.connect(delay);
  delay.connect(reverb);
  reverb.connect(destination);

  return {
    compressor,
    delay,
    reverb,
  };
}
