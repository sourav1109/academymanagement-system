# Exit on error
$ErrorActionPreference = "Stop"

# Configuration
$ENV_FILE = ".env"
$DOCKER_IMAGE = "school-management-system"
$DOCKER_COMPOSE_FILE = "docker-compose.yml"
$APP_PORT = 3000
$MONGODB_PORT = 27018
$HEALTH_CHECK_RETRIES = 3
$HEALTH_CHECK_INTERVAL = 10

# Function to log messages
function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message"
}

# Function to check if a port is in use
function Test-PortInUse {
    param($Port)
    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $false
    }
    catch {
        return $true
    }
    finally {
        if ($listener) {
            $listener.Stop()
        }
    }
}

# Function to wait for service health
function Wait-ForServiceHealth {
    param(
        [string]$Url,
        [int]$Retries = $HEALTH_CHECK_RETRIES,
        [int]$Interval = $HEALTH_CHECK_INTERVAL
    )
    
    $attempt = 0
    while ($attempt -lt $Retries) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Log "Service is healthy at $Url"
                return $true
            }
        }
        catch {
            $attempt++
            if ($attempt -eq $Retries) {
                Write-Log "Service health check failed after $Retries attempts"
                return $false
            }
            Write-Log "Waiting for service to be healthy... Attempt $attempt of $Retries"
            Start-Sleep -Seconds $Interval
        }
    }
    return $false
}

Write-Log "Starting enhanced local CI/CD pipeline..."

# Step 1: Check prerequisites
Write-Log "Checking prerequisites..."
$prerequisites = @(
    @{Name = "Node.js"; Command = "node --version"},
    @{Name = "npm"; Command = "npm --version"},
    @{Name = "Docker"; Command = "docker --version"},
    @{Name = "Docker Compose"; Command = "docker-compose --version"}
)

foreach ($prereq in $prerequisites) {
    try {
        $version = Invoke-Expression $prereq.Command
        Write-Log "$($prereq.Name) is installed: $version"
    }
    catch {
        Write-Log "Error: $($prereq.Name) is not installed or not in PATH"
        exit 1
    }
}

# Step 2: Check port availability
Write-Log "Checking port availability..."
if (Test-PortInUse $APP_PORT) {
    Write-Log "Error: Port $APP_PORT is already in use"
    exit 1
}
if (Test-PortInUse $MONGODB_PORT) {
    Write-Log "Error: Port $MONGODB_PORT is already in use"
    exit 1
}

# Step 3: Install dependencies
Write-Log "Installing dependencies..."
npm install

# Step 4: Run linting
Write-Log "Running linting..."
npm run lint

# Step 5: Run tests
Write-Log "Running tests..."
npm test

# Step 6: Build Docker image
Write-Log "Building Docker image..."
docker build -t $DOCKER_IMAGE .

# Step 7: Stop existing containers
Write-Log "Stopping existing containers..."
docker-compose -f $DOCKER_COMPOSE_FILE down

# Step 8: Start containers
Write-Log "Starting containers..."
docker-compose -f $DOCKER_COMPOSE_FILE up -d

# Step 9: Wait for services to be healthy
Write-Log "Waiting for services to be healthy..."
$appHealthy = Wait-ForServiceHealth -Url "http://localhost:$APP_PORT"
if (-not $appHealthy) {
    Write-Log "Error: Application failed to become healthy"
    docker-compose -f $DOCKER_COMPOSE_FILE logs app
    exit 1
}

# Step 10: Run security audit
Write-Log "Running security audit..."
npm audit

# Step 11: Backup MongoDB data (if needed)
Write-Log "Creating MongoDB backup..."
$backupDir = "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir
}
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir/mongodb_backup_$timestamp"
docker exec $(docker-compose -f $DOCKER_COMPOSE_FILE ps -q mongodb) mongodump --out /data/backup
docker cp $(docker-compose -f $DOCKER_COMPOSE_FILE ps -q mongodb):/data/backup $backupFile

# Step 12: Verify application functionality
Write-Log "Verifying application functionality..."
try {
    # Add your application-specific health checks here
    $response = Invoke-WebRequest -Uri "http://localhost:$APP_PORT" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Log "Application is running and responding"
    }
}
catch {
    Write-Log "Error: Application verification failed"
    docker-compose -f $DOCKER_COMPOSE_FILE logs app
    exit 1
}

Write-Log "Local CI/CD pipeline completed successfully!"
Write-Log "Application is running at http://localhost:$APP_PORT"
Write-Log "MongoDB is running on port $MONGODB_PORT"
Write-Log "Backup created at $backupFile" 