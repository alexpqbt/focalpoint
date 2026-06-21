FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY token_server.py .
CMD ["uvicorn", "token_server:app", "--host", "0.0.0.0", "--port", "5000"]

