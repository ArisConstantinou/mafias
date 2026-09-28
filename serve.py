#!/usr/bin/env python3
"""Optional local server; opening index.html directly also runs the game."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import argparse

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=5174)
    args=parser.parse_args()
    root=Path(__file__).resolve().parent
    server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(SimpleHTTPRequestHandler,directory=str(root)))
    print(f'Open http://127.0.0.1:{args.port} — Ctrl+C stops the server.')
    try: server.serve_forever()
    except KeyboardInterrupt: print('\nServer stopped.')
    finally: server.server_close()

if __name__=='__main__': main()
