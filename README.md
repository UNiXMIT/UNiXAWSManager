# [UNiXAWSManager](https://github.com/UNiXMIT/UNiXAWSManager)

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Cloud Environment](#cloud-environment)
- [Install Instructions](#install-instructions)
- [AWSManager Web UI](#awsmanager-web-ui)
- [Customization](#customization)
- [Check AWSManager Logs](#check-awsmanager-logs)

## Overview
UNiXAWSManager is a lightweight web app for day-to-day AWS EC2 operations. It provides a simple interface to view instances across regions, perform common lifecycle actions, and manage related metadata without switching between multiple AWS Console pages.  

## Features
- EC2 Instances view filtered by Owner and Region, with one-click start, stop, reboot, and terminate actions.  
- Inline instance tag management for Name, Owner, and SemStatus.  
- All Instances view with sortable columns and CSV export for reporting.  
- AMI listing for the selected region.  
- SEM Instances view that scans all available regions for Name tags matching SEM*.  
- Security Group management for create, delete, inspect, attach, and ingress rule updates.  


## Prerequisites
AWS credentials stored in the .aws directory of your home directory.  
Install Podman (or Docker).  
```
dnf install podman -y
```

## Cloud Environment
### Minimum AWS EC2 Instance requirements
t3.micro  
20GB SSD  

### Minimum Azure EC2 Instance requirements
Standard_B2ls_v2  
20GB SSD  

## Install Instructions
```
mkdir /home/support/awsmanager
git clone https://github.com/UNiXMIT/UNiXAWSManager.git /home/support/awsmanager
cd /home/support/awsmanager
chmod +x awsmanager.sh
./awsmanager.sh
``` 

## AWSManager Web UI
You can access the AWSManager Web UI with:  
```
http://serverIP:8989
```

## Customization 
```
-v /home/support/.aws:/root/.aws:ro,Z
-e AWS_DEFAULT_REGION=eu-west-2
-e DEFAULT_REGION=eu-west-2
-e DEFAULT_OWNER=SUPPORT
```

## Check AWSManager Logs
```
podman logs awsmanager
```