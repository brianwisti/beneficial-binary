import { defineConfig } from 'astro/config';
import remarkObsidian from 'remark-obsidian';
import { remarkDefinitionList, defListHastHandlers } from 'remark-definition-list';

// https://astro.build/config
export default defineConfig({
    markdown: {
        remarkPlugins: [remarkObsidian, remarkDefinitionList],
        remarkRehype: {
            handlers: {
                ...defListHastHandlers,
            }
        }
    }
});
