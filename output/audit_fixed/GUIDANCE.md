# Guided Next Steps (defensive)

Steps the orchestrator cannot fully automate because they need a running
process, live traffic, or extra tooling. Run them yourself on the authorized
target; each is read-only / analysis-oriented.

## Dynamic evidence
- **Capture app traffic** (network-interceptor) — needs the app running through a proxy:
  ```bash
  python network-interceptor/scripts/capture_traffic.py --port 8080 --duration 120 --out captured.har
  ```
  Then re-run the orchestrator; it auto-analyses the HAR.
- **Dump a process & scan for secrets** (memory-dumper) — needs the target process running:
  ```bash
  python memory-dumper/scripts/dump_process.py --name <proc>.exe --out proc.dmp
  python memory-dumper/scripts/scan_memory.py proc.dmp --out output/memory-analysis
  ```

## Not automated — defensive boundary
Per MASTER_POLICY §2, the toolkit does not auto-produce circumvention. The
following are excluded from the automatic flow: **master-unlock, dotnet-keygen,
binary-patcher, electron-builder-repacker**. For an authorized target, prefer the
defensive alternative: map the validation/entitlement flow, document weaknesses,
and write source-level hardening + tests for the legitimate path.
