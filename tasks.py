from invoke import task
from pathlib import Path
import os
import shutil
import platform
from locovote.mcas import download_mcas_data
from locovote.mass_gov_div_local_services import download_tables as download_financial_data
from locovote.general_fund import download_general_fund_data

DATA_DIR = Path("./data")
RAW_DIR = DATA_DIR / "raw"

# Define subdirectories for different data sources
DOR_GENERAL_FUND_DIR = RAW_DIR / "dor-general-fund"
DOR_COMMUNITY_COMPARISON_DIR = RAW_DIR / "dor-community-comparison"

def get_download_dir():
    """Get appropriate download directory based on environment."""
    if platform.system() == 'Darwin':
        # On macOS, use Downloads directory to avoid permissions issues
        return Path.home() / "Downloads"
    else:
        # For other environments, use the raw directory
        return RAW_DIR

def handle_macos_download(download_func, target_dir):
    """Handle downloads on macOS by downloading to Downloads dir and moving files.
    
    Args:
        download_func: Function that performs the download and returns list of downloaded files
        target_dir: Directory where files should end up
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    
    if platform.system() == 'Darwin':
        download_dir = get_download_dir()
        downloaded_files = download_func(download_dir)
        
        # Move downloaded files to target directory
        for file in downloaded_files:
            shutil.move(str(file), str(target_dir / file.name))
    else:
        download_func(target_dir)

@task
def download_mcas(c):
    """Download MCAS data to the data/raw directory."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    download_mcas_data(RAW_DIR)

@task
def download_dor_community_comparisons(c):
    """Download Mass DOR Community Comparison Report data."""
    if DOR_COMMUNITY_COMPARISON_DIR.exists():
        print(f"Directory {DOR_COMMUNITY_COMPARISON_DIR} already exists. Skipping download.")
        return
    
    handle_macos_download(
        download_func=download_financial_data,
        target_dir=DOR_COMMUNITY_COMPARISON_DIR
    )

@task
def download_dor_general_fund(c):
    """Download Mass DOR General Fund data."""
    if DOR_GENERAL_FUND_DIR.exists():
        print(f"Directory {DOR_GENERAL_FUND_DIR} already exists. Skipping download.")
        return
    
    handle_macos_download(
        download_func=download_general_fund_data,
        target_dir=DOR_GENERAL_FUND_DIR
    )

@task(download_mcas, download_dor_community_comparisons, download_dor_general_fund)
def download_all(c):
    """Download all data sources."""
    print("All downloads complete!")

@task
def clean_data(c):
    print("Cleaning data...")
    # Your data cleaning logic will go here
    # For example: c.run("python locovote/cleaner.py")

# @task(pre=[download_data, clean_data])
# def process_data(c):
#     print("Data processing complete.")
