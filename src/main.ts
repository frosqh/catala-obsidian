import { Plugin, Notice } from 'obsidian';

import { Extension } from '@codemirror/state';
import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const CATALA_KEYWORDS = [
    "champ d'application", "dépend de", "résultat de", "déclaration", "inclus", "liste de",
    "contenu de", "contenu", "type", "optionnel de", "structure", "énumération", "contexte",
    "entrée", "résultat", "interne", "règle", "sous condition", "condition", "donnée",
    "conséquence", "rempli", "égal à", "assertion", "définition", "état", "étiquette",
    "exception", "n'importe quel de type", "n'importe quel de", "n'importe quel", "liste vide",
    "est maximum", "est minimum", "minimum de", "maximum de", "combine tout",
    "transforme chaque", "en", "initialement", "trie tout", "trie", "par ordre décroissant",
    "par ordre croissant", "puis", "impossible", "selon", "sous forme", "mais en remplaçant",
    "fixé", "par", "inférieur", "supérieur", "varie", "avec", "on a", "soit", "dans", "tel que",
    "existe", "contient", "pour", "parmi", "tout", "de", "si", "alors", "sinon", "initial",
    "<struct>", "<énum>", "<défaut>", "<option>", "<closure_env>"
];

const CATALA_TYPES = [
    "entier", "booléen", "date", "durée", "argent", "position_source",
    "décimal", "décret", "loi", "nombre", "somme", "unit"
];

const CATALA_CONSTANTS = ["vrai", "faux"];

const CATALA_OPERATORS = ["non", "ou bien", "ou", "et", "an", "mois", "jour", "→"];

const keywordDeco = Decoration.mark({ class: "catala-keyword" });
const typeDeco = Decoration.mark({ class: "catala-type" });
const constantDeco = Decoration.mark({ class: "catala-constant" });
const operatorDeco = Decoration.mark({ class: "catala-operator" });

const catalaSyntaxHighlighter = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) { this.decorations = this.buildDecorations(view); }
    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();

        const catalaBlocks: {from: number, to: number}[] = [];
        let inCatalaBlock = false;
        let currentBlockStart = 0;

        for (let i = 1; i <= view.state.doc.lines; i++) {
            const line = view.state.doc.line(i);
            const text = line.text.trim();
            if (!inCatalaBlock && text.startsWith('```catala')) {
                inCatalaBlock = true;
                currentBlockStart = line.from;
            } else if (inCatalaBlock && text.startsWith('```')) {
                inCatalaBlock = false;
                catalaBlocks.push({ from: currentBlockStart, to: line.to });
            }
        }
        if (inCatalaBlock) catalaBlocks.push({ from: currentBlockStart, to: view.state.doc.length });

        const allWords = [...CATALA_KEYWORDS, ...CATALA_TYPES, ...CATALA_CONSTANTS, ...CATALA_OPERATORS]
            .sort((a, b) => b.length - a.length);

        const regexStr = allWords.map(w => {
            const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const startBound = /^[\p{L}\p{N}]/u.test(w) ? '(?<![\\p{L}\\p{N}_])' : '';
            const endBound = /[\p{L}\p{N}]$/u.test(w) ? '(?![\\p{L}\\p{N}_])' : '';

            return `${startBound}${escaped}${endBound}`;
        }).join('|');

        const regex = new RegExp(`(${regexStr})`, 'gu');

        for (let { from, to } of view.visibleRanges) {
            const text = view.state.sliceDoc(from, to);
            let match;

            while ((match = regex.exec(text)) !== null) {
                const word = match[0];
                const startPos = from + match.index;
                const endPos = startPos + word.length;

                const isInsideCatala = catalaBlocks.some(block => startPos >= block.from && endPos <= block.to);

                if (isInsideCatala) {
                    let deco = keywordDeco;
                    if (CATALA_TYPES.includes(word)) deco = typeDeco;
                    else if (CATALA_CONSTANTS.includes(word)) deco = constantDeco;
                    else if (CATALA_OPERATORS.includes(word)) deco = operatorDeco;

                    builder.add(startPos, endPos, deco);
                }
            }
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});

export default class CatalaPlugin extends Plugin {
    displayMode = 0;
    statusBarItem: HTMLElement;

    async onload() {
        console.log("Plugin Catala chargé !");

		this.registerEditorExtension(catalaSyntaxHighlighter);

        this.addRibbonIcon('eye', 'Changer l\'affichage Catala', (evt: MouseEvent) => {
            this.cycleDisplayMode();
        });

        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.setText('Catala : Tout');
        this.statusBarItem.classList.add('mod-clickable');
        this.statusBarItem.addEventListener('click', () => {
            this.cycleDisplayMode();
        });

        this.addCommand({
            id: 'cycle-catala-display',
            name: 'Cycler l\'affichage (Tout / Code / Texte)',
            callback: () => {
                this.cycleDisplayMode();
            }
        });
    }

    cycleDisplayMode() {
		// 0 = Tout, 1 = Code uniquement, 2 = Texte uniquement
        this.displayMode = (this.displayMode + 1) % 3;

        document.body.classList.remove('catala-mode-code-only', 'catala-mode-text-only');

        if (this.displayMode === 0) {
            this.statusBarItem.setText('Catala : Tout');
            new Notice('Affichage : Tout');

        } else if (this.displayMode === 1) {
            document.body.classList.add('catala-mode-code-only');
            this.statusBarItem.setText('Catala : Code');
            new Notice('Affichage : Code uniquement');

        } else if (this.displayMode === 2) {
            document.body.classList.add('catala-mode-text-only');
            this.statusBarItem.setText('Catala : Texte');
            new Notice('Affichage : Texte uniquement');
        }
    }

    onunload() {
        document.body.classList.remove('catala-mode-code-only', 'catala-mode-text-only');
        console.log("Plugin Catala déchargé !");
    }
}
