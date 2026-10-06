# One AI Cloud with the web app. Build from the one-ai/ folder:
#   docker build -f cloud/Dockerfile -t one-ai .
# Only the Python standard library is needed.
FROM python:3.12-slim
WORKDIR /app
COPY cloud/onecloud ./onecloud
COPY web ./web
RUN mkdir -p /data
ENV PORT=8788 ONEAI_DB=/data/oneai.sqlite3 ONEAI_WEB_DIR=/app/web PYTHONUNBUFFERED=1
EXPOSE 8788
VOLUME /data
HEALTHCHECK CMD python -c "import urllib.request,os;urllib.request.urlopen('http://127.0.0.1:%s/v1/health' % os.environ['PORT'])"
CMD ["python", "-m", "onecloud"]
