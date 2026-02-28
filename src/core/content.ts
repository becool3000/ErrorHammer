import generatedBundle from "../generated/content.bundle.json";
import { ContentBundle } from "./types";

export function loadContentBundle(): ContentBundle {
  const bundle = generatedBundle as Partial<ContentBundle>;
  if (!Array.isArray(bundle.tools)) {
    throw new Error("Invalid generated content: missing tools[]");
  }
  if (!Array.isArray(bundle.jobs)) {
    throw new Error("Invalid generated content: missing jobs[]");
  }
  if (!Array.isArray(bundle.events)) {
    throw new Error("Invalid generated content: missing events[]");
  }
  if (!Array.isArray(bundle.districts)) {
    throw new Error("Invalid generated content: missing districts[]");
  }
  if (!Array.isArray(bundle.bots)) {
    throw new Error("Invalid generated content: missing bots[]");
  }
  if (!Array.isArray(bundle.supplies)) {
    throw new Error("Invalid generated content: missing supplies[]");
  }
  if (!bundle.strings || typeof bundle.strings !== "object") {
    throw new Error("Invalid generated content: missing strings");
  }

  return bundle as ContentBundle;
}
