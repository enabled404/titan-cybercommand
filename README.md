# Titan Cyber Command

**Try it live: [titan-cybercommand.vercel.app](https://titan-cybercommand.vercel.app)**

**Global Kinetic Cyber Warfare & Real-Time Threat Intelligence Monitor**

Every hack, exploit, breach, and kinetic cyber assault, live on one interactive 3D globe. Featuring a real-time ballistic particle missile engine, procedural tactical audio synthesizer, subsea fiber optic infrastructure, interactive disaster simulation, and passive domain reconnaissance.

---

## Breakthrough Capabilities

- **Kinetic Ballistic Particle Engine**: Real-time laser trajectories arcing high through the exosphere from threat actor command-and-control nodes to victim targets, complete with glowing comet heads, fading trails, and concentric impact shockwaves.
- **Procedural DEFCON Audio Synthesizer**: Built entirely on the Web Audio API with zero external audio downloads. Features a 55Hz sub-bass tactical reactor drone, stereo-panned laser swooshes, impact thuds, terminal relay clicks, and dual-frequency alert chimes.
- **WarGames Cascading Disaster Simulator**: Interactive simulation engine to test catastrophic scenarios including subsea fiber optic cable severance, global cloud hypervisor panic, and SCADA electrical grid infiltration.
- **Target Recon Passive Scanner**: Enter any domain (e.g. `apple.com`, `tesla.com`, or your company) to execute non-invasive OSINT reconnaissance: DNS routing, SPF/DMARC mail spoof defense, ransomware leak site exposures, and active CVE correlations with a real-time Threat Posture score (A+ to F).
- **Submarine Internet Cables Layer**: Physical infrastructure layer rendering global deep-sea fiber optic cables (MAREA, Dunant, Grace Hopper, SEA-ME-WE 5, FASTER, 2Africa) directly on the ocean floor.
- **New CVEs & CISA KEV**: Real-time ticker and index at `/cve` of critical CVEs published in the last 72 hours and flaws CISA confirmed actively exploited.
- **Patch Now Dock**: Software currently weaponized by attackers today, saying in plain English what can happen, who is affected, and what fixes it.
- **Am I Affected?**: Select the apps, packages, and companies you use to see what attackers are exploiting in them.
- **Agent Runbooks & MCP Server**: One-click runbooks for Claude Code, Codex, and Cursor, plus a read-only Model Context Protocol (MCP) server at `/api/mcp` and `llms.txt`.

---

## Status, Honestly

| Status        | Means                                                       |
| ------------- | ----------------------------------------------------------- |
| Confirmed     | Acknowledged by the organisation, a regulator or a filing   |
| Reported      | Covered by the press, not yet confirmed by the organisation |
| Claimed       | Asserted by attackers on a leak site, unverified            |
| Precautionary | Systems taken offline as a precaution, no compromise stated |
| Disputed      | Reported, and denied by the organisation                    |

*An absent result is never proof that you are safe.*

---

## Run Locally

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # fill in what you have
pnpm dev
```

Open `http://localhost:3000`.

To build for production:
```bash
pnpm build
pnpm start
```

---

## Quality & Development Verification

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src
pnpm exec vitest run
```

---

## Acknowledgement & Inspiration

Titan Cyber Command was built upon the design foundation and initial data pipeline architecture of [yorkeccak/globalhackmap](https://github.com/yorkeccak/globalhackmap), completely re-engineered, modernized, and expanded with real-time ballistic particle physics, procedural audio, physical subsea infrastructure, interactive disaster simulation, and target reconnaissance.

---

## License

Code: MIT (see [LICENSE](LICENSE)). Fonts in `src/assets/fonts` are under the SIL Open Font License.
