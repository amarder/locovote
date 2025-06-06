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
from selenium.common.exceptions import TimeoutException, WebDriverException, StaleElementReferenceException

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
    
    # Additional stability options for cloud environments
    options.add_argument("--disable-gpu")
    options.add_argument("--single-process")
    options.add_argument("--no-zygote")
    options.add_argument("--disable-web-security")
    options.add_argument("--disable-features=VizDisplayCompositor")
    
    # Memory and performance optimizations for CI environments
    options.add_argument("--memory-pressure-off")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_argument("--disable-backgrounding-occluded-windows")
    
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

def wait_for_page_stability(driver, timeout=10):
    """Wait for page to be stable and ready for interaction."""
    try:
        # Wait for document ready state
        WebDriverWait(driver, timeout).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )
        
        # Wait for jQuery to be loaded and ready (if present)
        WebDriverWait(driver, timeout).until(
            lambda d: d.execute_script("return typeof jQuery == 'undefined' || jQuery.active == 0")
        )
        
        # Additional wait for any dynamic content
        time.sleep(2)
        return True
    except Exception as e:
        print(f"Warning: Page stability check failed: {e}")
        return False

def load_page_with_retries(driver, max_attempts=3):
    """Load the main page with retry logic."""
    for attempt in range(max_attempts):
        try:
            print(f"Loading page (attempt {attempt + 1}/{max_attempts})")
            driver.get("https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund")
            
            if wait_for_page_stability(driver, timeout=30):
                # Verify key elements are present
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.ID, "islYear_handler"))
                )
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.ID, "islAmountType"))
                )
                print("Page loaded successfully")
                return True
            else:
                raise Exception("Page stability check failed")
                
        except Exception as e:
            if attempt < max_attempts - 1:
                print(f"Error loading page: {e}")
                time.sleep(5 + (attempt * 2))
                continue
            else:
                print(f"Failed to load page after {max_attempts} attempts: {e}")
                return False
    
    return False

def select_fiscal_year(driver, year, timeout=30, max_retries=2):
    """Select fiscal year using the custom YUI dropdown with retry logic."""
    for attempt in range(max_retries):
        try:
            print(f"Selecting fiscal year {year} (attempt {attempt + 1}/{max_retries})...")
            
            # Wait for page stability before attempting
            wait_for_page_stability(driver)
            
            # Find and click the year dropdown button
            year_button = WebDriverWait(driver, timeout).until(
                EC.element_to_be_clickable((By.ID, "islYear_handler"))
            )
            
            # Scroll to element and ensure it's in view
            driver.execute_script("arguments[0].scrollIntoView(true);", year_button)
            time.sleep(1)
            
            # Try clicking with JavaScript if regular click fails
            try:
                year_button.click()
            except WebDriverException:
                driver.execute_script("arguments[0].click();", year_button)
            
            time.sleep(2)  # Wait for dropdown to open
            
            # First uncheck any currently checked years
            try:
                checked_boxes = driver.find_elements(By.CSS_SELECTOR, "input[name='islYear']:checked")
                for checkbox in checked_boxes:
                    if checkbox.is_displayed() and checkbox.is_enabled():
                        try:
                            checkbox.click()
                        except (StaleElementReferenceException, WebDriverException):
                            # Element might have become stale, try with JavaScript
                            driver.execute_script("arguments[0].click();", checkbox)
                    time.sleep(0.5)
            except Exception as e:
                print(f"Warning: Could not uncheck existing selections: {e}")
            
            # Find and click the specific year checkbox
            year_checkbox = WebDriverWait(driver, timeout).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, f"input[name='islYear'][value='{year}']"))
            )
            
            # Ensure checkbox is visible and clickable
            driver.execute_script("arguments[0].scrollIntoView(true);", year_checkbox)
            time.sleep(1)
            
            try:
                year_checkbox.click()
            except WebDriverException:
                driver.execute_script("arguments[0].click();", year_checkbox)
            
            time.sleep(2)  # Wait for selection to register
            
            # Click somewhere else to close the dropdown
            driver.execute_script("arguments[0].click();", driver.find_element(By.TAG_NAME, "body"))
            time.sleep(2)
            
            # Verify the selection took effect by checking the button text
            try:
                button_text = year_button.find_element(By.CLASS_NAME, "rd-checkboxlist-caption").text
                if str(year) in button_text:
                    print(f"Successfully selected fiscal year {year}")
                    return True
                else:
                    print(f"Year selection verification failed. Button shows: {button_text}")
            except Exception as e:
                print(f"Could not verify year selection: {e}")
                # If we can't verify, assume it worked and continue
                return True
            
        except Exception as e:
            print(f"Error selecting fiscal year (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                print("Waiting before retry...")
                time.sleep(3 + attempt)  # Progressive backoff
            else:
                print(f"Failed to select fiscal year {year} after {max_retries} attempts")
                return False
    
    return False

def select_amount_type(driver, amount_type, timeout=30, max_retries=2):
    """Select amount type (revenues/expenditures) using the dropdown with retry logic."""
    for attempt in range(max_retries):
        try:
            print(f"Selecting {amount_type} (attempt {attempt + 1}/{max_retries})...")
            
            # Wait for page stability
            wait_for_page_stability(driver)
            
            # Find and click the amount type dropdown
            amount_select = WebDriverWait(driver, timeout).until(
                EC.element_to_be_clickable((By.ID, "islAmountType"))
            )
            
            # Scroll to element
            driver.execute_script("arguments[0].scrollIntoView(true);", amount_select)
            time.sleep(1)
            
            Select(amount_select).select_by_value(amount_type.capitalize())
            time.sleep(2)
            
            # Verify the selection took effect
            selected_option = Select(amount_select).first_selected_option
            if selected_option.get_attribute("value") == amount_type.capitalize():
                print(f"Successfully selected {amount_type}")
                return True
            else:
                print(f"Amount type selection verification failed. Selected: {selected_option.get_attribute('value')}")
            
        except Exception as e:
            print(f"Error selecting amount type (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 + attempt)
            else:
                print(f"Failed to select amount type {amount_type} after {max_retries} attempts")
                return False
    
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

def download_single_file(year, data_type, download_dir, max_retries=3):
    """Download a single file using a fresh browser session."""
    expected_filename = f"GenFund{data_type.capitalize()}{year}.xlsx"
    filepath = download_dir / expected_filename
    
    for attempt in range(max_retries):
        driver = None
        try:
            print(f"Downloading {year} {data_type} (attempt {attempt + 1}/{max_retries})...")
            
            # Create fresh driver for each attempt
            driver = setup_chrome(download_dir)
            
            # Load the page
            if not load_page_with_retries(driver):
                raise Exception("Failed to load page")
            
            # Select fiscal year
            if not select_fiscal_year(driver, year):
                raise Exception(f"Failed to select fiscal year {year}")
            
            # Select amount type
            if not select_amount_type(driver, data_type):
                raise Exception(f"Failed to select amount type {data_type}")
            
            print("Clicking submit button...")
            # Click submit button
            submit_btn = WebDriverWait(driver, 15).until(
                EC.element_to_be_clickable((By.ID, "btnSubmit"))
            )
            driver.execute_script("arguments[0].scrollIntoView(true);", submit_btn)
            time.sleep(1)
            driver.execute_script("arguments[0].click();", submit_btn)
            print("Successfully clicked submit")
            
            # Wait for data table to load
            if not wait_for_data_table(driver):
                raise Exception("Failed to load data table")
            
            print("Waiting for export button...")
            # Wait for results and export button
            export_btn = WebDriverWait(driver, 30).until(
                EC.element_to_be_clickable((By.ID, "btnExport"))
            )
            time.sleep(2)  # Give the page a moment to fully load
            
            print("Clicking export button...")
            # Click export
            driver.execute_script("arguments[0].scrollIntoView(true);", export_btn)
            time.sleep(1)
            driver.execute_script("arguments[0].click();", export_btn)
            print("Successfully clicked export")
            
            # Wait for download
            print("Waiting for file download...")
            start_time = time.time()
            while time.time() - start_time < 45:  # Increased timeout
                if filepath.exists():
                    time.sleep(3)  # Ensure download completes
                    print(f"Successfully downloaded: {expected_filename}")
                    return filepath
                time.sleep(1)
            
            raise Exception(f"Download timeout: {expected_filename}")
            
        except Exception as e:
            print(f"Error downloading {year} {data_type} (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                print("Waiting before retry...")
                time.sleep(5 + (attempt * 2))  # Progressive backoff
            else:
                print(f"Failed to download {year} {data_type} after {max_retries} attempts")
                return None
        
        finally:
            # Always cleanup the driver after each attempt
            if driver:
                try:
                    driver.quit()
                    time.sleep(2)  # Give time for cleanup
                except Exception as e:
                    print(f"Error closing driver: {e}")
    
    return None

def download_general_fund_data(download_dir=Path("./downloads"), force_download=False):
    """Download General Fund data from MA DOR Schedule A.
    
    Returns:
        list[Path]: List of paths to the downloaded files
    """
    download_dir.mkdir(exist_ok=True)
    downloaded_files = []
    
    try:
        # Process each fiscal year and type with individual browser sessions
        for year in YEARS:
            for data_type in TYPES:
                expected_filename = f"GenFund{data_type.capitalize()}{year}.xlsx"
                filepath = download_dir / expected_filename
                
                if filepath.exists() and not force_download:
                    print(f"Found existing file: {expected_filename}")
                    downloaded_files.append(filepath)
                    continue
                
                # Download with fresh browser session
                result_path = download_single_file(year, data_type, download_dir)
                if result_path:
                    downloaded_files.append(result_path)
                else:
                    print(f"Skipping {year} {data_type} due to persistent errors")
                
                # Brief pause between downloads to be nice to the server
                time.sleep(3)
    
    except KeyboardInterrupt:
        print("Download interrupted by user")
    except Exception as e:
        print(f"Critical error in download process: {e}")
    
    print(f"Downloaded {len(downloaded_files)} files successfully")
    return downloaded_files

if __name__ == "__main__":
    download_general_fund_data() 
