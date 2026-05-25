@echo off
chcp 65001 >nul 2>&1

set IMAGE=docker.cnb.cool/rich/public/mcp-tools-debugger:latest
set CLIENT_PORT=6274
set SERVER_PORT=6277
set CONTAINER_NAME=mcp-tools-debugger

echo 清理旧容器...
docker rm -f %CONTAINER_NAME% >nul 2>&1

echo 正在拉取镜像: %IMAGE%
docker pull %IMAGE%
if %errorlevel% neq 0 (
    echo 拉取镜像失败！
    pause
    exit /b 1
)

echo 正在启动容器...
docker run -d ^
  --name %CONTAINER_NAME% ^
  -p %CLIENT_PORT%:%CLIENT_PORT% ^
  -p %SERVER_PORT%:%SERVER_PORT% ^
  -e HOST=0.0.0.0 ^
  %IMAGE%

if %errorlevel% neq 0 (
    echo 启动容器失败！
    pause
    exit /b 1
)

echo.
echo 启动成功！访问 http://localhost:%CLIENT_PORT%
pause
