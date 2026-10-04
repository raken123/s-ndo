# Hub AI Cloud. Only the Python standard library is needed.
FROM python:3.12-slim
WORKDIR /app
COPY hubcloud ./hubcloud
COPY agents.json ./
# Runs as root so it can write to whatever disk the host mounts at /data.
RUN mkdir -p /data
ENV PORT=8787 HUBAI_DB=/data/hubai.sqlite3 PYTHONUNBUFFERED=1
EXPOSE 8787
VOLUME /data
HEALTHCHECK CMD python -c "import urllib.request,os;urllib.request.urlopen('http://127.0.0.1:%s/v1/health' % os.environ['PORT'])"
CMD ["python", "-m", "hubcloud"]
