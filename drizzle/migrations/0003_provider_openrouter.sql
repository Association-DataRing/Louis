-- v0.4 — Ajoute le provider 'openrouter' à l'enum provider_type.
-- OpenRouter expose une API OpenAI-compatible avec un catalogue de
-- modèles agrégés (Anthropic, OpenAI, Mistral, Llama, etc.) → utile
-- pour avoir un fallback multi-fournisseurs avec une seule clé.
-- Idempotent : IF NOT EXISTS sur les types enum.

ALTER TYPE "provider_type" ADD VALUE IF NOT EXISTS 'openrouter';
