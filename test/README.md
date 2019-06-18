# app-opmaster's example

Build the plugin:

```bash
npm run build
```

Start worker(s):

```bash
export DEVEBOT_OPFLOW_URI=amqp://master:zaq123edcx@localhost
DEBUG=fibonacci* node test/lab/fibonacci_worker.js
```

Start client:

```bash
export DEVEBOT_OPFLOW_URI=amqp://master:zaq123edcx@localhost
DEBUG=none node test/lab/fibonacci_client.js
```
