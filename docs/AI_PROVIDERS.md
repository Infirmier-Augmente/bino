# Fournisseurs d'IA

Aucun code métier ne connaît un fournisseur. Tout passe par quatre **ports** (`packages/ai`) :

| Port | Rôle | Implémentations |
| --- | --- | --- |
| `LlmPort` | Structuration DAR, admission | AI SDK : DeepSeek, OpenAI, Anthropic, Mistral, Google, Groq, **tout serveur compatible OpenAI** |
| `SttPort` | Transcription d'un enregistrement entier, côté serveur (optionnel) | OpenAI (`whisper-1`, `gpt-transcribe`…), Groq Whisper, **serveur auto-hébergé compatible OpenAI** |
| `LiveSttPort` | Texte provisoire pendant la dictée, côté serveur (optionnel) | OpenAI Realtime (`gpt-live-transcribe`) |
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

Deux ports, côté serveur uniquement :

- `SttPort` (fichier) : transcrit un enregistrement entier. Sert à `POST /transcriptions` et au
  texte final de la dictée en direct.
- `LiveSttPort` (direct) : texte provisoire pendant la dictée, derrière le WebSocket
  `/transcriptions/live`. Un seul adaptateur : OpenAI Realtime (`packages/ai/src/stt/openai-realtime.ts`).

Choix du moteur dans l'app (`apps/mobile/src/lib/dictation-engine.ts`), d'après `GET /config` :

1. **dictée en direct** si `sttLive.ready` ;
2. sinon **transcription à la fin** si `stt.ready` : l'app enregistre (`expo-audio`) et envoie le
   fichier à `POST /transcriptions` à l'arrêt ;
3. sinon, sur navigateur (PC, Chrome Android, Safari iOS) : la reconnaissance vocale du navigateur,
   texte en direct ;
4. sinon : le micro du clavier du téléphone.

Avec un STT serveur, la reconnaissance du navigateur n'est plus utilisée (Chrome Android répète des
mots en mode continu).

```bash
STT_PROVIDER=openai
STT_API_KEY=...
STT_MODEL=gpt-transcribe        # texte final ; défaut openai : whisper-1
# STT_LIVE_MODEL=gpt-live-transcribe   (défaut) ; « none » = pas de direct

STT_PROVIDER=groq               # transcription à la fin seulement
STT_API_KEY=...
# STT_MODEL=whisper-large-v3-turbo (défaut Groq)

STT_PROVIDER=openai-compatible  # faster-whisper-server / speaches auto-hébergé (piste HDS), à la fin seulement
STT_BASE_URL=http://localhost:8000/v1
STT_MODEL=Systran/faster-whisper-large-v3
```

Le lexique soignant (`domain/rules/lexicon.ts`) est envoyé comme vocabulaire à favoriser, au port
fichier comme au direct (`dictationPrompt()`, `apps/api/src/http/transcription.ts`).

### Dictée en direct : deux passes (DECISIONS T23)

Le direct n'existe qu'avec `STT_PROVIDER=openai` : il est activé d'office dès que `STT_API_KEY` est
renseignée (même clé, même `STT_BASE_URL`), sauf `STT_LIVE_MODEL=none`. Avec `groq` ou
`openai-compatible`, `sttLive.ready` est faux et l'app enregistre puis transcrit.

1. **Pendant la dictée** : l'app envoie le son du micro à l'API (PCM 16 bits mono 24 kHz, trames
   binaires). L'API garde tout le son en mémoire et le relaie à `gpt-live-transcribe`. Le texte
   provisoire arrive mot à mot, environ 1,3 s derrière la voix. Ce modèle écrit souvent les nombres
   en lettres (« quatre-vingt-quatorze ») : il ne sert qu'à l'affichage.
2. **À l'arrêt** : l'API retranscrit tout l'enregistrement (WAV, `pcm16ToWav`) avec le port fichier
   (`STT_MODEL`). Avec `gpt-transcribe` : nombres en chiffres, contexte complet. Ce texte final
   remplace le provisoire, environ 1,1 à 1,7 s après l'arrêt. C'est lui qui part à la structuration
   et à l'ancrage des chiffres.

Prix au 14/11 : `gpt-live-transcribe` 0,017 $/min, `gpt-transcribe` 0,0045 $/min. Une dictée en
direct paie les deux.

Replis :

- connexion WebSocket refusée, pas ouverte en 4 s, ou direct non configuré côté API : l'app bascule
  sur l'enregistrement + `POST /transcriptions` ;
- direct en panne pendant la dictée : l'API continue d'enregistrer, le texte final arrive quand même ;
- texte final absent au bout de 20 s, ou en échec : l'app garde le texte provisoire et demande de le
  relire.

Limites : 300 s par dictée (au-delà, l'API arrête et transcrit), trames WebSocket de 1 Mio au plus.

**Ajouter un fournisseur de direct** : un adaptateur `LiveSttPort` dans `packages/ai/src/stt/`, son nom
dans `STT_LIVE_PROVIDERS` et son choix dans `config.ts` et `services.ts`. Rien d'autre ne bouge.

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
