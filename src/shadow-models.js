import manifest from './shadow-models/manifest.json';

// Eager bundled JSON: selection never fetches or trains a model.
const artifacts = import.meta.glob(['./shadow-models/*.json', './shadow-weights.json'],
  { eager: true, import: 'default' });
export const defaultModel = manifest.defaultModel;
export const models = manifest.models.map((entry) => {
  const key = entry.artifact === '../shadow-weights.json'
    ? './shadow-weights.json' : `./shadow-models/${entry.artifact.slice(2)}`;
  if (!artifacts[key]) throw new Error(`Missing model artifact: ${entry.id}`);
  return { ...artifacts[key], ...entry };
});
