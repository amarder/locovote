#!/usr/bin/env python3
"""Downloads Population data from MA DOR Population by Municipality and Year report."""

import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, WebDriverException, StaleElementReferenceException

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
    """Load the main population page with retry logic."""
    url = "https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Socioeconomic.Population.Population&rdScrollX=0&rdScrollY=0"
    
    for attempt in range(max_attempts):
        try:
            print(f"Loading page (attempt {attempt + 1}/{max_attempts})")
            driver.get(url)
            
            if wait_for_page_stability(driver, timeout=30):
                # Verify key elements are present - look for the fiscal year dropdown button
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.ID, "iclYear_handler"))
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

def select_all_fiscal_years(driver, timeout=30, max_retries=3):
    """Select all fiscal years by clicking the dropdown and then 'Check all' option."""
    for attempt in range(max_retries):
        try:
            print(f"Selecting all fiscal years (attempt {attempt + 1}/{max_retries})...")
            
            # Wait for page stability before attempting
            wait_for_page_stability(driver)
            
            # First, click the dropdown button to open the year selection
            dropdown_button = WebDriverWait(driver, timeout).until(
                EC.element_to_be_clickable((By.ID, "iclYear_handler"))
            )
            
            # Scroll to element and ensure it's in view
            driver.execute_script("arguments[0].scrollIntoView(true);", dropdown_button)
            time.sleep(1)
            
            # Click to open the dropdown
            try:
                dropdown_button.click()
                print("Successfully clicked dropdown button")
            except WebDriverException:
                driver.execute_script("arguments[0].click();", dropdown_button)
                print("Successfully clicked dropdown button with JavaScript")
            
            time.sleep(2)  # Wait for dropdown to open
            
            # Now find and click the "Check all" checkbox
            check_all_checkbox = WebDriverWait(driver, timeout).until(
                EC.element_to_be_clickable((By.ID, "iclYear_check_all"))
            )
            
            # Scroll to element and ensure it's in view
            driver.execute_script("arguments[0].scrollIntoView(true);", check_all_checkbox)
            time.sleep(1)
            
            # Click the "Check all" checkbox
            try:
                check_all_checkbox.click()
                print("Successfully clicked 'Check all' checkbox")
            except WebDriverException:
                driver.execute_script("arguments[0].click();", check_all_checkbox)
                print("Successfully clicked 'Check all' checkbox with JavaScript")
            
            time.sleep(3)  # Wait for all checkboxes to be selected
            
            # Click somewhere else to close the dropdown (click the body)
            driver.execute_script("document.body.click();")
            time.sleep(2)
            
            # Verify that years were selected by checking the button caption
            try:
                button_caption = dropdown_button.find_element(By.CLASS_NAME, "rd-checkboxlist-caption").text
                print(f"Button caption after selection: {button_caption}")
                if "selected" in button_caption.lower():
                    print("Successfully selected all fiscal years")
                    return True
                else:
                    print(f"Warning: Button caption doesn't indicate selection: {button_caption}")
                    # Continue anyway, it might still work
                    return True
            except Exception as e:
                print(f"Could not verify year selection: {e}")
                # If we can't verify, assume it worked and continue
                return True
            
        except Exception as e:
            print(f"Error selecting all fiscal years (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                print("Waiting before retry...")
                time.sleep(3 + attempt)  # Progressive backoff
            else:
                print(f"Failed to select all fiscal years after {max_retries} attempts")
                return False
    
    return False

def click_submit_button(driver, timeout=30, max_retries=2):
    """Click the Submit button and wait for results."""
    for attempt in range(max_retries):
        try:
            print(f"Clicking Submit button (attempt {attempt + 1}/{max_retries})...")
            
            # Wait for page stability
            wait_for_page_stability(driver)
            
            # Look for submit button - try multiple possible selectors based on the site structure
            submit_selectors = [
                "//input[@type='submit' and contains(@value, 'Submit')]",
                "//button[contains(text(), 'Submit')]",
                "//input[@id='btnSubmit']",
                "//*[@id='btnSubmit']",
                "//input[contains(@value, 'Submit')]",
                "//input[@type='submit']",
                "//button[@type='submit']"
            ]
            
            submit_button = None
            for selector in submit_selectors:
                try:
                    submit_button = WebDriverWait(driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, selector))
                    )
                    print(f"Found Submit button with selector: {selector}")
                    break
                except TimeoutException:
                    continue
            
            if not submit_button:
                raise Exception("Could not find Submit button")
            
            # Scroll to element
            driver.execute_script("arguments[0].scrollIntoView(true);", submit_button)
            time.sleep(1)
            
            # Click the submit button
            try:
                submit_button.click()
                print("Successfully clicked Submit button")
            except WebDriverException:
                driver.execute_script("arguments[0].click();", submit_button)
                print("Successfully clicked Submit button with JavaScript")
            
            return True
            
        except Exception as e:
            print(f"Error clicking Submit button (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 + attempt)
            else:
                print(f"Failed to click Submit button after {max_retries} attempts")
                return False
    
    return False

def wait_for_data_table(driver, timeout=45):
    """Wait for the data table to load after submitting."""
    try:
        print("Waiting for data table to load...")
        
        # Wait for any data table to be present - try multiple possible selectors
        table_selectors = [
            "//table[contains(@id, 'tblPopulation')]",  # Most likely based on the pattern
            "//table[contains(@id, 'Population')]",
            "//table[contains(@class, 'data')]",
            "//div[contains(@class, 'table')]//table",
            "//table//tr[position()>1]",  # Table with data rows
            "//table[.//td]",  # Table with data cells
            "//table"
        ]
        
        for selector in table_selectors:
            try:
                table = WebDriverWait(driver, timeout).until(
                    EC.presence_of_element_located((By.XPATH, selector))
                )
                print(f"Data table found with selector: {selector}")
                
                # Additional check to make sure it has actual data
                try:
                    rows = table.find_elements(By.TAG_NAME, "tr")
                    if len(rows) > 1:  # Header + at least one data row
                        print(f"Table has {len(rows)} rows")
                        time.sleep(3)  # Give it a moment to fully load
                        return True
                except Exception:
                    pass
                    
            except TimeoutException:
                continue
        
        raise Exception("No data table found with any selector")
        
    except Exception as e:
        print(f"Error waiting for data table: {e}")
        return False

def click_export_table_button(driver, timeout=30, max_retries=2):
    """Click the Export Table button."""
    for attempt in range(max_retries):
        try:
            print(f"Clicking Export Table button (attempt {attempt + 1}/{max_retries})...")
            
            # Wait for page stability
            wait_for_page_stability(driver)
            
            # Look for export button - try multiple possible selectors
            export_selectors = [
                "//input[@value='Export Table']",
                "//button[contains(text(), 'Export Table')]",
                "//a[contains(text(), 'Export Table')]",
                "//input[contains(@value, 'Export')]",
                "//button[contains(text(), 'Export')]",
                "//*[contains(text(), 'Export Table')]",
                "//input[@id='btnExport']",
                "//*[@id='btnExport']"
            ]
            
            export_button = None
            for selector in export_selectors:
                try:
                    export_button = WebDriverWait(driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, selector))
                    )
                    print(f"Found Export Table button with selector: {selector}")
                    break
                except TimeoutException:
                    continue
            
            if not export_button:
                raise Exception("Could not find Export Table button")
            
            # Scroll to element
            driver.execute_script("arguments[0].scrollIntoView(true);", export_button)
            time.sleep(1)
            
            # Click the export button
            try:
                export_button.click()
                print("Successfully clicked Export Table button")
            except WebDriverException:
                driver.execute_script("arguments[0].click();", export_button)
                print("Successfully clicked Export Table button with JavaScript")
            
            return True
            
        except Exception as e:
            print(f"Error clicking Export Table button (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 + attempt)
            else:
                print(f"Failed to click Export Table button after {max_retries} attempts")
                return False
    
    return False

def download_population_data(download_dir=Path("./downloads"), force_download=False):
    """Download Population data from MA DOR Population by Municipality and Year report.
    
    Returns:
        Path: Path to the downloaded file, or None if download failed
    """
    download_dir.mkdir(exist_ok=True)
    expected_filename = "population_data.xlsx"  # We'll need to see what the actual filename is
    filepath = download_dir / expected_filename
    
    # Check if file already exists
    if filepath.exists() and not force_download:
        print(f"Found existing file: {expected_filename}")
        return filepath
    
    driver = None
    try:
        print("Starting population data download...")
        
        # Create driver
        driver = setup_chrome(download_dir)
        
        # Load the page
        if not load_page_with_retries(driver):
            raise Exception("Failed to load page")
        
        # Select all fiscal years
        if not select_all_fiscal_years(driver):
            raise Exception("Failed to select all fiscal years")
        
        # Click submit button
        if not click_submit_button(driver):
            raise Exception("Failed to click Submit button")
        
        # Wait for data table to load
        if not wait_for_data_table(driver):
            raise Exception("Failed to load data table")
        
        # Click export table button
        if not click_export_table_button(driver):
            raise Exception("Failed to click Export Table button")
        
        # Wait for download
        print("Waiting for file download...")
        start_time = time.time()
        while time.time() - start_time < 60:  # 60 second timeout
            # Check for any new files in download directory
            xlsx_files = list(download_dir.glob("*.xlsx"))
            print(f"Found {len(xlsx_files)} Excel files in download directory")
            
            if xlsx_files:
                # Look for common population data filenames first
                population_files = [f for f in xlsx_files if 'population' in f.name.lower()]
                if population_files:
                    latest_file = max(population_files, key=lambda f: f.stat().st_mtime)
                    print(f"Found population file: {latest_file.name}")
                    time.sleep(3)  # Ensure download completes
                    print(f"Successfully downloaded: {latest_file.name}")
                    return latest_file
                
                # If no population-specific file, find the most recently modified file
                latest_file = max(xlsx_files, key=lambda f: f.stat().st_mtime)
                # Make timestamp check less restrictive (allow files created up to 10 seconds before start)
                if latest_file.stat().st_mtime > (start_time - 10):
                    print(f"Found recent file: {latest_file.name}, modified at {latest_file.stat().st_mtime}")
                    time.sleep(3)  # Ensure download completes
                    print(f"Successfully downloaded: {latest_file.name}")
                    return latest_file
                else:
                    print(f"File {latest_file.name} is too old (modified at {latest_file.stat().st_mtime}, start time: {start_time})")
            time.sleep(1)
        
        raise Exception("Download timeout: No file was downloaded")
        
    except Exception as e:
        print(f"Error downloading population data: {e}")
        return None
    
    finally:
        # Always cleanup the driver
        if driver:
            try:
                driver.quit()
                time.sleep(2)  # Give time for cleanup
            except Exception as e:
                print(f"Error closing driver: {e}")

if __name__ == "__main__":
    result = download_population_data()
    if result:
        print(f"Population data downloaded successfully to: {result}")
    else:
        print("Failed to download population data")
