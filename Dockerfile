FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN pip install --no-cache-dir "fastapi>=0.110,<1" "uvicorn>=0.29,<1" "httpx>=0.27,<1"
COPY app/ /app/
EXPOSE 9410
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9410", "--proxy-headers", "--forwarded-allow-ips", "*"]
