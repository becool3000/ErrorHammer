import { useEffect, useRef } from "react";
import { bundle, useUiStore } from "./state";
import { getReadingObfuscationMeta, obfuscateReadableTextByMeta } from "./readability";
import { Title } from "./screens/Title";
import { GameShell } from "./screens/GameShell";

const OBFUSCATION_SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);

export function App() {
  const screen = useUiStore((state) => state.screen);
  const game = useUiStore((state) => state.game);
  const uiTextScale = useUiStore((state) => state.uiTextScale);
  const uiColorMode = useUiStore((state) => state.uiColorMode);
  const uiFxMode = useUiStore((state) => state.uiFxMode);
  const hydrateUiPrefs = useUiStore((state) => state.hydrateUiPrefs);
  const originalTextRef = useRef<WeakMap<Text, string>>(new WeakMap());
  const appliedTextRef = useRef<WeakMap<Text, string>>(new WeakMap());

  useEffect(() => {
    hydrateUiPrefs();
  }, [hydrateUiPrefs]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const root = document.querySelector<HTMLElement>(".app-root");
    if (!root) {
      return;
    }

    const readingMeta = game ? getReadingObfuscationMeta(game) : null;
    const shouldObfuscate = Boolean(screen === "game" && game && readingMeta && !readingMeta.fullyClear);
    const originalTextNodes = originalTextRef.current;
    const appliedTextNodes = appliedTextRef.current;

    let isApplying = false;
    const applyObfuscation = () => {
      if (isApplying) {
        return;
      }
      isApplying = true;
      try {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let textNode = walker.nextNode() as Text | null;
        let nodeIndex = 0;
        while (textNode) {
          const parent = textNode.parentElement;
          if (!parent) {
            textNode = walker.nextNode() as Text | null;
            nodeIndex += 1;
            continue;
          }
          if (
            OBFUSCATION_SKIPPED_TAGS.has(parent.tagName) ||
            parent.closest("[data-obfuscate-ignore='true']") ||
            parent.closest("[aria-live='assertive']")
          ) {
            textNode = walker.nextNode() as Text | null;
            nodeIndex += 1;
            continue;
          }

          const currentText = textNode.nodeValue ?? "";
          if (currentText.trim().length === 0) {
            textNode = walker.nextNode() as Text | null;
            nodeIndex += 1;
            continue;
          }

          if (!originalTextNodes.has(textNode)) {
            originalTextNodes.set(textNode, currentText);
          }
          const appliedText = appliedTextNodes.get(textNode);
          let originalText = originalTextNodes.get(textNode) ?? currentText;

          if (!shouldObfuscate || !readingMeta) {
            if (appliedText && textNode.nodeValue === appliedText) {
              textNode.nodeValue = originalText;
            }
            originalTextNodes.set(textNode, textNode.nodeValue ?? "");
            appliedTextNodes.delete(textNode);
          } else {
            if (appliedText && currentText !== appliedText) {
              originalText = currentText;
              originalTextNodes.set(textNode, currentText);
            }
            const obfuscatedText = obfuscateReadableTextByMeta(
              originalText,
              `${screen}:${nodeIndex}:${parent.tagName}:${normalizeClassToken(parent.className)}`,
              readingMeta
            );
            if (textNode.nodeValue !== obfuscatedText) {
              textNode.nodeValue = obfuscatedText;
            }
            appliedTextNodes.set(textNode, obfuscatedText);
          }

          textNode = walker.nextNode() as Text | null;
          nodeIndex += 1;
        }
      } finally {
        isApplying = false;
      }
    };

    applyObfuscation();
    const observer = new MutationObserver(() => applyObfuscation());
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
    };
  }, [game, screen]);

  return (
    <div className="app-root" data-text-scale={uiTextScale} data-color-mode={uiColorMode} data-fx-mode={uiFxMode}>
      {screen === "title" ? <Title title={bundle.strings.title} subtitle={bundle.strings.subtitle} /> : <GameShell />}
    </div>
  );
}

function normalizeClassToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, ".");
}
