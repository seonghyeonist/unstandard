# Vendored `braces` security backport

This private local package contains the source from [micromatch/braces PR #72](https://github.com/micromatch/braces/pull/72), upstream head commit `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`. The backport adds a 100-level nesting limit during parsing and AST traversal to prevent deeply nested input from exhausting the JavaScript call stack.

The upstream source still identifies itself as version 3.0.3. This copy uses `3.0.4+unstandard.1` only to distinguish the local patched source from the published package; it is not an upstream release. Keep this fork until an official fixed release is available, then remove the local override and update the lockfile.

The package remains a development dependency because it is used by the Next.js lint tooling. It does not change application runtime dependencies.
