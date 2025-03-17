# Banco Galatico

## Configurar Render
Coloca em um repositorio do git e sincroniza em um projeto no https://render.com/

Build Command 

```bash
pip install -r requirements.txt
```

Start Command
```bash
gunicorn --worker-class gevent --workers 1 app:app
```