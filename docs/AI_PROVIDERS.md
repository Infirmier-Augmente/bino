# Fournisseurs d'IA

Aucun code métier ne connaît un fournisseur. Tout passe par trois **ports** (`packages/ai`) :

| Port | Rôle | Implémentations |
| --- | --- | --- |
| `LlmPort` | Structuration DAR, admission | AI SDK : DeepSeek, OpenAI, Anthropic, Mistral, Google, Groq, **tout serveur compatible OpenAI** |
| `SttPort` | Transcription audio côté serveur (optionnel) | OpenAI Whisper, Groq Whisper, **serveur auto-hébergé compatible OpenAI** |
| `ClassifierPort` | Jugements typés avec probabilités (patient ambigu, gravité) | **Jev (TypeSafe)**, LLM, règles locales |

Changer de fournisseur = modifier `.env` puis relancer l'API. Vérifier avec `pnpm sim eval`.

## LLM

```bash
# Local, sans réseau (défaut) : moteur heuristique déterministe
LLM_PROVIDER=heuristic

# DeepSeek (testé : ~2 s / dictée, 0 invention sur les scénarios)
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
LLM_API_KEY=...

# OpenAI / Anthropic / Mistral / Google / Groq : LLM_MODEL obligatoire
LLM_PROVIDER=mistral
LLM_MODEL=mistral-large-latest
LLM_API_KEY=...

# Tout serveur compatible OpenAI : Ollama, vLLM, LM Studio, OVHcloud AI Endpoints, Scaleway…
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:14b
```

Garde-fous indépendants du fournisseur : sortie validée par schéma, ancrage des sources, délai max
(`LLM_TIMEOUT_MS`), repli automatique sur le moteur local (`LLM_FALLBACK=heuristic`).

**Ajouter un fournisseur** : une ligne dans `packages/ai/src/llm/providers.ts` + son nom dans
`LLM_PROVIDERS` (`config.ts`) + la doc ici.

## Speech-to-text

Une clé `OPENROUTER_API_KEY` active aussi la transcription (`openai/whisper-1` sur
`/audio/transcriptions`), tant que `STT_PROVIDER` reste `none`.

Sans STT serveur (`STT_PROVIDER=none` et pas de clé OpenRouter), l'app utilise :

- sur navigateur (PC, Chrome Android, Safari iOS) : la reconnaissance vocale du navigateur, texte en direct ;
- sur l'app native : le micro du clavier du téléphone.

Avec un STT serveur, l'app native enregistre (`expo-audio`) et envoie à `POST /transcriptions` :

```bash
STT_PROVIDER=groq            # ou openai
STT_API_KEY=...
# STT_MODEL=whisper-large-v3-turbo (défaut Groq) / whisper-1 (défaut OpenAI)

STT_PROVIDER=openai-compatible   # faster-whisper-server / speaches auto-hébergé (piste HDS)
STT_BASE_URL=http://localhost:8000/v1
STT_MODEL=Systran/faster-whisper-large-v3
```

Le lexique soignant (`domain/rules/lexicon.ts`) est envoyé comme vocabulaire à favoriser.

## Classifieur (Jev / TypeSafe)

Jev renvoie des **réponses typées avec des probabilités calibrées** (Choice, Score, Noul) au lieu de
générer du texte. Usages dans le produit :

- **Patient ambigu** : quand les règles hésitent (« la dame de la 8 », noms proches), une question
  *Choice* départage ; sous 0,6 de confiance, on **demande** à l'infirmière.
- **Gravité des cibles** : une question *Score* par cible (routine → urgente), un seul appel par dictée,
  utilisée pour trier la relève (jamais affichée comme un verdict).

```bash
CLASSIFIER_PROVIDER=jev
JEV_API_KEY=...
JEV_MODEL=jev-latest      # épingler une version (ex. jev-1.14.0) si on règle des seuils
```

`CLASSIFIER_PROVIDER=llm` réutilise le LLM configuré (probabilités auto-déclarées, moins fiables) ;
`heuristic` = règles locales, confiance volontairement basse.

## Souveraineté / HDS (pitch)

Avec `openai-compatible` pour le LLM et le STT, tout peut tourner sur une infrastructure hébergée HDS
ou dans le réseau de l'hôpital, sans changer une ligne de code métier.
