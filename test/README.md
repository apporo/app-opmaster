# 

Build the plugin:
```bash
npm run build
```

Start worker(s):
```bash
DEBUG=fibonacci* node test/lab/fibonacci_worker.js
```

Start client:
```bash
DEBUG=none node test/lab/fibonacci_client.js
```
