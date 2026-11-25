import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'firebase',
              test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
            },
            {
              name: 'dungeon',
              test: /[\\/]src[\\/](dungeon|scenes[\\/]DungeonScene|world[\\/]dungeonGen)/,
            },
          ],
        },
      },
    },
  },
});
