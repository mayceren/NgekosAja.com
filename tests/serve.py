"""Quiet static server with a larger connection backlog for concurrent browser QA."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import os

os.chdir(Path(__file__).resolve().parents[1])
class Server(ThreadingHTTPServer):
    request_queue_size=128
    daemon_threads=True
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass
if __name__=='__main__':
    server=Server(('127.0.0.1',5500),Handler)
    print('NgekosAja QA: http://127.0.0.1:5500',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:server.server_close()
