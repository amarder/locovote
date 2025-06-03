#!/usr/bin/env python3
"""Downloads all tables from MA DOR Community Comparison Report."""

import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

def setup_chrome(download_dir):
    """Configure Chrome for headless download."""
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    
    # Anti-detection measures
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-dev-shm-usage")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    # Download settings
    options.add_experimental_option("prefs", {
        "download.default_directory": str(download_dir.absolute()),
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True,
        "safebrowsing.disable_download_protection": True,
        "profile.default_content_setting_values.automatic_downloads": 1,
        "profile.default_content_settings.popups": 0,
        "profile.content_settings.exceptions.automatic_downloads.*.setting": 1
    })
    
    # Additional safeguards
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--safebrowsing-disable-download-protection")
    
    driver = webdriver.Chrome(options=options)
    
    # Remove webdriver flags
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    return driver

def download_tables(download_dir=Path("./downloads"), force_download=False):
    """Download all tables from the MA DOR Community Comparison Report."""
    download_dir.mkdir(exist_ok=True)
    
    # Expected filenames for each tab
    expected_files = {
        'General/Socioeconomic': 'CommunityComparisonGeneral.xlsx',
        'Values by Class': 'CC_Assessed_Value_by_Class.xlsx',
        'Revenues by Source': 'CC_Revenue_by_Source.xlsx',
        'Levies & Rates by Class': 'CC_Levies_and_Tax_by_Class.xlsx',
        'Prop 2½ Levy Capacity': 'CC_Prop2_5_Levy_Capacity.xlsx',
        'Outstanding Receivables': 'CC_Outstanding_Receivables.xlsx',
        'Spending by Function': 'CC_GF_Spend_by_Fun.xlsx',
        'Financial Indicators': 'Other_Finacial_Indicators.xlsx'
    }
    
    # Check if all files exist
    if not force_download:
        all_exist = True
        missing_files = []
        for tab_text, filename in expected_files.items():
            filepath = download_dir / filename
            if not filepath.exists():
                all_exist = False
                missing_files.append(filename)
        
        if all_exist:
            print("All files already exist. Use force_download=True to redownload.")
            return
        else:
            print("Missing files:", ", ".join(missing_files))
    
    with setup_chrome(download_dir) as driver:
        # Navigate to report page with retry logic
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"Attempting to load page (attempt {attempt + 1}/{max_retries})")
                driver.get("https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=community_comparison_report")
                
                # Wait for page load with a longer timeout
                WebDriverWait(driver, 45).until(EC.presence_of_element_located((By.CLASS_NAME, "yui-nav")))
                
                # Check for 403 error
                if "403 Forbidden" in driver.page_source:
                    if attempt < max_retries - 1:
                        print("Got 403 error, retrying...")
                        time.sleep(5 + (attempt * 2))
                        continue
                    else:
                        raise Exception("Site is blocking access (403 Forbidden)")
                
                # Additional verification that page loaded correctly
                if "Community Comparison Report" in driver.page_source:
                    print("Page loaded successfully")
                    break
                    
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Error loading page: {e}")
                    time.sleep(5 + (attempt * 2))
                    continue
                raise
        
        # Process each tab
        for tab_text, filename in expected_files.items():
            filepath = download_dir / filename
            if filepath.exists() and not force_download:
                print(f"Found existing file: {filename}")
                continue
                
            print(f"Downloading: {filename}")
            
            try:
                # Click tab with retry
                for _ in range(3):
                    try:
                        tab = WebDriverWait(driver, 15).until(
                            EC.element_to_be_clickable((By.XPATH, f"//span[contains(text(), '{tab_text}')]/parent::em/parent::a"))
                        )
                        driver.execute_script("arguments[0].click();", tab)
                        time.sleep(3)
                        break
                    except:
                        print(f"Retrying tab click for: {tab_text}")
                        time.sleep(2)
                
                # Click export with retry
                for _ in range(3):
                    try:
                        export_btn = WebDriverWait(driver, 10).until(
                            EC.element_to_be_clickable((By.XPATH, "//input[@value='Export to Excel']"))
                        )
                        driver.execute_script("arguments[0].click();", export_btn)
                        break
                    except:
                        print(f"Retrying export click for: {filename}")
                        time.sleep(2)
                
                # Wait for download
                start_time = time.time()
                while time.time() - start_time < 30:
                    if filepath.exists():
                        time.sleep(2)  # Ensure download completes
                        print(f"Successfully downloaded: {filename}")
                        break
                    time.sleep(1)
                
                if not filepath.exists():
                    print(f"Failed to download: {filename}")
                
                # Brief pause between downloads
                time.sleep(2)
                
            except Exception as e:
                print(f"Error processing {filename}: {e}")
                continue

if __name__ == "__main__":
    download_tables()
