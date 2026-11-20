"""Run both migration passes and the HTTP/DB suite on a disposable PostgreSQL cluster."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
from tempfile import TemporaryDirectory

APP = Path(__file__).resolve().parents[1]


def pg(name):
    bin_dir = os.environ.get("B2C_PG_BIN")
    path = str(Path(bin_dir) / name) if bin_dir else shutil.which(name)
    if not path or not Path(path).is_file():
        print("PostgreSQL tools unavailable. Set B2C_PG_BIN to a PostgreSQL 17 bin directory.", file=sys.stderr)
        raise SystemExit(78)
    return path


def run(*args, env=None):
    subprocess.run(args, cwd=APP, env=env, check=True)


def main():
    for name in ("initdb", "pg_ctl"):
        pg(name)
    with TemporaryDirectory(prefix="unstandard-b2c-pg-") as folder:
        data = str(Path(folder) / "data")
        log = str(Path(folder) / "postgres.log")
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        run(pg("initdb"), "-D", data, "--no-locale", "--encoding=UTF8", "--auth=trust",
            "--username=b2c_fixture", "--no-sync")
        run(pg("pg_ctl"), "-D", data, "-l", log,
            "-o", f"""-h 127.0.0.1 -p {port} -c unix_socket_directories='' -c dynamic_shared_memory_type=mmap""",
            "-w", "start")
        try:
            run("node", "--input-type=module", "-e", """
                import pg from "pg";
                const client = new pg.Client({
                    host: "127.0.0.1", port: Number(process.argv[1]),
                    user: "b2c_fixture", database: "postgres"
                });
                await client.connect();
                try { await client.query("create database unstandard_b2c"); }
                finally { await client.end(); }
                """, str(port))
            env = dict(os.environ)
            env.update(
                B2C_DATABASE_URL=f"postgresql://b2c_fixture@127.0.0.1:{port}/unstandard_b2c",
                B2C_MIGRATE_CONFIRM="local-b2c",
                B2C_DB_FIXTURES="disposable-loopback",
            )
            run("npm", "run", "db:migrate", env=env)
            run("npm", "run", "db:migrate", env=env)
            if sys.argv[1:] == ["payment"]:
                run("node", "--test", "tests/payment.integration.mts", env=env)
            else:
                run("npm", "run", "test:db", env=env)
        finally:
            run(pg("pg_ctl"), "-D", data, "-m", "fast", "-w", "stop")


if __name__ == "__main__":
    main()
