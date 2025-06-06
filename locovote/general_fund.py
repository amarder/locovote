#!/usr/bin/env python3
"""Downloads General Fund data from MA DOR Schedule A."""

import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import TimeoutException

YEARS = range(2002, 2025)
TYPES = ["revenues", "expenditures"]

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

def select_fiscal_year(driver, year, timeout=30):
    """Select fiscal year using the custom YUI dropdown."""
    try:
        print(f"Selecting fiscal year {year}...")
        
        # Find and click the year dropdown button
        year_button = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((By.ID, "islYear_handler"))
        )
        year_button.click()
        time.sleep(1)  # Wait for dropdown to open
        
        # First uncheck any currently checked years
        checked_boxes = driver.find_elements(By.CSS_SELECTOR, "input[name='islYear']:checked")
        for checkbox in checked_boxes:
            checkbox.click()
            time.sleep(0.5)
        
        # Find and click the specific year checkbox
        year_checkbox = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, f"input[name='islYear'][value='{year}']"))
        )
        year_checkbox.click()
        time.sleep(1)  # Wait for selection to register
        
        # Click somewhere else to close the dropdown
        driver.execute_script("arguments[0].click();", driver.find_element(By.TAG_NAME, "body"))
        time.sleep(1)
        
        # Verify the selection took effect by checking the button text
        button_text = year_button.find_element(By.CLASS_NAME, "rd-checkboxlist-caption").text
        if str(year) not in button_text:
            print(f"Year selection verification failed. Button shows: {button_text}")
            return False
        
        return True
    except Exception as e:
        print(f"Error selecting fiscal year: {e}")
        return False

def select_amount_type(driver, amount_type, timeout=30):
    """Select amount type (revenues/expenditures) using the dropdown."""
    try:
        print(f"Selecting {amount_type}...")
        
        # Find and click the amount type dropdown
        amount_select = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((By.ID, "islAmountType"))
        )
        Select(amount_select).select_by_value(amount_type.capitalize())
        time.sleep(1)
        
        # Verify the selection took effect
        selected_option = Select(amount_select).first_selected_option
        if selected_option.get_attribute("value") != amount_type.capitalize():
            print(f"Amount type selection verification failed. Selected: {selected_option.get_attribute('value')}")
            return False
        
        return True
    except Exception as e:
        print(f"Error selecting amount type: {e}")
        return False

def wait_for_data_table(driver, timeout=30):
    """Wait for the data table to load after submitting."""
    try:
        print("Waiting for data table to load...")
        # Wait for the data table to be present and visible
        table = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.ID, "xtGenFund"))
        )
        # Wait for at least one data row
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#xtGenFund tbody tr"))
        )
        print("Data table loaded successfully")
        return True
    except Exception as e:
        print(f"Error waiting for data table: {e}")
        return False

def download_general_fund_data(download_dir=Path("./downloads"), force_download=False):
    """Download General Fund data from MA DOR Schedule A.
    
    Returns:
        list[Path]: List of paths to the downloaded files
    """
    download_dir.mkdir(exist_ok=True)
    downloaded_files = []
    
    with setup_chrome(download_dir) as driver:
        # Navigate to report page with retry logic
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"Attempting to load page (attempt {attempt + 1}/{max_retries})")
                driver.get("https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund")
                
                # Wait for page to load completely
                WebDriverWait(driver, 30).until(
                    lambda d: d.execute_script("return document.readyState") == "complete"
                )
                time.sleep(3)  # Additional wait for any dynamic content
                
                print("Page loaded successfully")
                break
                
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Error loading page: {e}")
                    time.sleep(5 + (attempt * 2))
                    continue
                raise
        
        # Process each fiscal year and type
        for year in YEARS:
            for data_type in TYPES:
                expected_filename = f"GenFund{data_type.capitalize()}{year}.xlsx"
                filepath = download_dir / expected_filename
                
                if filepath.exists() and not force_download:
                    print(f"Found existing file: {expected_filename}")
                    downloaded_files.append(filepath)
                    continue
                
                print(f"Downloading {year} {data_type}...")
                
                try:
                    # Select fiscal year
                    if not select_fiscal_year(driver, year):
                        print(f"Failed to select fiscal year {year}")
                        continue
                    
                    # Select amount type
                    if not select_amount_type(driver, data_type):
                        print(f"Failed to select amount type {data_type}")
                        continue
                    
                    print("Clicking submit button...")
                    # Click submit button
                    submit_btn = WebDriverWait(driver, 10).until(
                        EC.element_to_be_clickable((By.ID, "btnSubmit"))
                    )
                    driver.execute_script("arguments[0].click();", submit_btn)
                    print("Successfully clicked submit")
                    
                    # Wait for data table to load
                    if not wait_for_data_table(driver):
                        print("Failed to load data table")
                        continue
                    
                    print("Waiting for export button...")
                    # Wait for results and export button
                    export_btn = WebDriverWait(driver, 30).until(
                        EC.element_to_be_clickable((By.ID, "btnExport"))
                    )
                    time.sleep(2)  # Give the page a moment to fully load
                    
                    print("Clicking export button...")
                    # Click export
                    driver.execute_script("arguments[0].click();", export_btn)
                    print("Successfully clicked export")
                    
                    # Wait for download
                    print("Waiting for file download...")
                    start_time = time.time()
                    while time.time() - start_time < 30:
                        if filepath.exists():
                            time.sleep(2)  # Ensure download completes
                            print(f"Successfully downloaded: {expected_filename}")
                            downloaded_files.append(filepath)
                            break
                        time.sleep(1)
                    
                    if not filepath.exists():
                        print(f"Failed to download: {expected_filename}")
                    
                    # Brief pause between downloads
                    time.sleep(3)
                    
                except Exception as e:
                    print(f"Error processing {year} {data_type}: {e}")
                    continue
    
    return downloaded_files

if __name__ == "__main__":
    download_general_fund_data() 
