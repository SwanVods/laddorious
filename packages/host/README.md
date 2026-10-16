# @laddorious/host

The match host: one match's engine state, window timers and bots, for any mix of humans and bots. Each human only ever receives `viewFor(state, them)` and `eventsFor(events, them)`.

Two places run it:

- the client's offline Web Worker (`apps/client/src/worker/localHost.ts`), with one human;
- the server's match room (`apps/server/src/room.ts`), with up to four.

It also holds what both sides share: the seat and update types, the wire protocol (`PROTOCOL_VERSION`, the lobby and match messages) and `buildSeats`. Browser-safe: no Node built-ins.
