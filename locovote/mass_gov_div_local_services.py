#!/usr/bin/env python3
"""
Massachusetts Department of Revenue Community Comparison Report Data Exporter

This script exports data from the DOR Community Comparison Report using Selenium:
https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=community_comparison_report&rdRequestForwarding=Form

The script uses a headless browser to interact with the JavaScript-heavy site to export comprehensive 
municipal data for all 351 Massachusetts municipalities.

Available Data Tables:
- General/Socioeconomic: Demographics, population, tax bills, income per capita, land area, etc.
- Assessed Values by Class: Property values categorized by class
- Revenue by Source: Property taxes, state aid, local receipts, other revenue sources
- Levies & Rates by Class: Tax levies and rates for different property classes
- Prop 2½ Levy Capacity: Information about Proposition 2½ levy capacity
- Outstanding Receivables: Data on outstanding municipal receivables
- General Fund Spending by Function: Municipal spending categorized by function
- Financial Indicators: Debt ratios, operating ratios, capital spending, reserve funds

Requirements:
- Python 3.x
- Chrome/Chromium browser
- ChromeDriver (matching Chrome version)
- Selenium package (pip install selenium)

ChromeDriver Installation:
- macOS: brew install chromedriver
- Linux: sudo apt-get install chromium-chromedriver
- Windows: Download from https://chromedriver.chromium.org/

Basic Usage:
    from mass_gov_div_local_services import MassDORDataExporter
    
    # Export a single table
    with MassDORDataExporter(download_dir="./data") as exporter:
        filepath = exporter.export_table('revenues_by_source')
    
    # Export with filters
    with MassDORDataExporter(download_dir="./data") as exporter:
        filters = {
            'min_population': 20000,
            'min_income_per_capita': 75000
        }
        filepath = exporter.export_table('general', filters)
    
    # Export all tables
    with MassDORDataExporter(download_dir="./data") as exporter:
        results = exporter.export_all_tables()

Available Filters:
- min_population / max_population: Filter by community population
- min_tax_bill / max_tax_bill: Filter by average single family tax bill
- min_income_per_capita / max_income_per_capita: Filter by income per capita
- min_eqv_per_capita / max_eqv_per_capita: Filter by equalized value per capita

Output:
- Files are saved as Excel (.xlsx) format
- Default download directory: ./downloads/
- Filename format: CC_{TableName}_{timestamp}.xlsx

Performance:
- Single table export: ~30-60 seconds
- All tables export: ~15-20 minutes
- Network dependent: Slower on poor connections

Troubleshooting:
- "ChromeDriver not found": Install ChromeDriver for your platform
- Empty/small files: Check internet connection, try with headless=False
- Browser crashes: Update Chrome/ChromeDriver to matching versions
- Permission errors: Ensure download directory is writable

Note: This tool is for research and educational purposes. Please respect the site's 
terms of service and avoid overloading the server with excessive requests.
"""

import time
import logging
from pathlib import Path
from typing import Optional, Dict, Any

# Selenium imports
try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.keys import Keys
    from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False
    print("ERROR: Selenium is required for this script. Install with: pip install selenium")
    exit(1)

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MassDORDataExporter:
    """Exports data from Massachusetts DOR Community Comparison Report using Selenium"""
    
    BASE_URL = "https://dls-gw.dor.state.ma.us"
    REPORT_URL = f"{BASE_URL}/reports/rdPage.aspx"
    
    # Available export tables and their IDs
    EXPORT_TABLES = {
        'general': {
            'id': 'tblTab1General',
            'name': 'General_Socioeconomic',
            'description': 'General/Socioeconomic data',
            'tab_text': 'General/Socioeconomic'
        },
        'values_by_class': {
            'id': 'tblTab2AssessedValueByClass',
            'name': 'Values_by_Class',
            'description': 'Assessed Values by Class',
            'tab_text': 'Values by Class'
        },
        'revenues_by_source': {
            'id': 'tblTab4RevenueBySource',
            'name': 'Revenue_by_Source',
            'description': 'Revenues by Source',
            'tab_text': 'Revenues by Source'
        },
        'levies_rates': {
            'id': 'tblTab3LeviesRatesbyClass',
            'name': 'Levies_Rates_by_Class',
            'description': 'Levies & Rates by Class',
            'tab_text': 'Levies & Rates by Class'
        },
        'prop_2_5_levy': {
            'id': 'tblTab5Prop2_5LevyCapacity',
            'name': 'Prop2_5_Levy_Capacity',
            'description': 'Prop 2½ Levy Capacity',
            'tab_text': 'Prop 2½ Levy Capacity'
        },
        'receivables': {
            'id': 'tblTab6OutstandingReceivables',
            'name': 'Outstanding_Receivables',
            'description': 'Outstanding Receivables',
            'tab_text': 'Outstanding Receivables'
        },
        'spending': {
            'id': 'tblTab7GeneralFundSpendingbyFunction',
            'name': 'Spending_by_Function',
            'description': 'General Fund Spending by Function',
            'tab_text': 'Spending by Function'
        },
        'financial_indicators': {
            'id': 'tblTab8OtherFinancialIndicators',
            'name': 'Financial_Indicators',
            'description': 'Other Financial Indicators',
            'tab_text': 'Financial Indicators'
        }
    }
    
    def __init__(self, download_dir: str = "./downloads", headless: bool = True):
        """Initialize the exporter
        
        Args:
            download_dir: Directory to save downloaded files
            headless: Whether to run browser in headless mode
        """
        if not SELENIUM_AVAILABLE:
            raise ImportError("Selenium is required. Install with: pip install selenium")
            
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(exist_ok=True)
        self.headless = headless
        self.driver = None
    
    def _setup_driver(self):
        """Setup Chrome WebDriver with appropriate options"""
        chrome_options = Options()
        
        if self.headless:
            chrome_options.add_argument("--headless")
        
        # Anti-detection options
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-web-security")
        chrome_options.add_argument("--allow-running-insecure-content")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Set a realistic user agent
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        # Additional anti-detection measures
        chrome_options.add_argument("--disable-extensions")
        chrome_options.add_argument("--disable-plugins")
        chrome_options.add_argument("--disable-images")  # Faster loading
        chrome_options.add_argument("--no-first-run")
        chrome_options.add_argument("--no-default-browser-check")
        chrome_options.add_argument("--disable-default-apps")
        
        # Set download preferences
        prefs = {
            "download.default_directory": str(self.download_dir.absolute()),
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "safebrowsing.enabled": True,
            "plugins.always_open_pdf_externally": True,
            "profile.default_content_setting_values.notifications": 2,
            "profile.default_content_settings.popups": 0
        }
        chrome_options.add_experimental_option("prefs", prefs)
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            
            # Remove navigator.webdriver flag
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # Set realistic window size and position
            self.driver.set_window_size(1920, 1080)
            self.driver.set_page_load_timeout(30)
            
            logger.info("Chrome WebDriver initialized successfully")
            
        except WebDriverException as e:
            logger.error(f"Failed to initialize Chrome WebDriver: {e}")
            logger.info("Make sure Chrome and ChromeDriver are installed")
            raise
    
    def _navigate_to_report(self):
        """Navigate to the community comparison report page with retry logic"""
        url = f"{self.REPORT_URL}?rdReport=community_comparison_report&rdRequestForwarding=Form"
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                logger.info(f"Navigating to: {url} (attempt {attempt + 1}/{max_retries})")
                
                # Add some human-like delay
                if attempt > 0:
                    delay = 5 + (attempt * 2)  # Progressive delay
                    logger.info(f"Waiting {delay} seconds before retry...")
                    time.sleep(delay)
                
                self.driver.get(url)
                
                # Wait for page to load
                WebDriverWait(self.driver, 20).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                
                # Check if we got a 403 error
                if "403 Forbidden" in self.driver.page_source:
                    logger.warning(f"Got 403 Forbidden error on attempt {attempt + 1}")
                    if attempt < max_retries - 1:
                        continue
                    else:
                        raise Exception("Website is blocking access - got 403 Forbidden")
                
                logger.info("Page loaded successfully")
                
                # Give the page extra time to fully render
                time.sleep(5)
                
                # Check if the page actually loaded correctly
                if "Community Comparison Report" in self.driver.page_source or "community_comparison_report" in self.driver.page_source:
                    logger.info("Confirmed we're on the correct page")
                    return
                else:
                    logger.warning("Page loaded but doesn't appear to be the correct report page")
                    if attempt < max_retries - 1:
                        continue
                    else:
                        logger.error("Failed to load the correct page after all retries")
                
            except TimeoutException:
                logger.error(f"Page load timeout on attempt {attempt + 1}")
                if attempt < max_retries - 1:
                    continue
                else:
                    raise
            except Exception as e:
                logger.error(f"Navigation error on attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    continue
                else:
                    raise
    
    def _apply_filters(self, filters: Dict[str, Any]):
        """Apply filters to the report"""
        if not filters:
            return
            
        logger.info(f"Applying filters: {filters}")
        
        # Map filter keys to form field names/IDs
        filter_mapping = {
            'min_population': ['txtMinPopulation', 'Minimum Population'],
            'max_population': ['txtMaxPopulation', 'Maximum Population'],
            'min_tax_bill': ['txtMinAverageSingleFamilyTaxBill', 'Minimum Average Single Family Tax Bill'],
            'max_tax_bill': ['txtMaxAverageSingleFamilyTaxBill', 'Maximum Average Single Family Tax Bill'],
            'min_income_per_capita': ['txtMinDORIncomePerCapita', 'Minimum DOR Income Per Capita'],
            'max_income_per_capita': ['txtMaxDORIncomePerCapita', 'Maximum DOR Income Per Capita'],
            'min_eqv_per_capita': ['txtMinEQVPerCapita', 'Minimum EQV Per Capita'],
            'max_eqv_per_capita': ['txtMaxEQVPerCapita', 'Maximum EQV Per Capita']
        }
        
        for filter_key, value in filters.items():
            if filter_key in filter_mapping and value is not None:
                field_identifiers = filter_mapping[filter_key]
                
                element_found = False
                for identifier in field_identifiers:
                    try:
                        # Try multiple selectors
                        selectors = [
                            (By.NAME, identifier),
                            (By.ID, identifier),
                            (By.XPATH, f"//input[@name='{identifier}']"),
                            (By.XPATH, f"//input[@id='{identifier}']")
                        ]
                        
                        for by_method, selector in selectors:
                            try:
                                element = self.driver.find_element(by_method, selector)
                                if element.is_displayed() and element.is_enabled():
                                    element.clear()
                                    element.send_keys(str(value))
                                    logger.info(f"Set {identifier} = {value}")
                                    element_found = True
                                    break
                            except NoSuchElementException:
                                continue
                        
                        if element_found:
                            break
                            
                    except Exception as e:
                        logger.debug(f"Failed to set {identifier}: {e}")
                        continue
                
                if not element_found:
                    logger.warning(f"Could not find form field for {filter_key}")
        
        # Give the page time to process filter changes
        time.sleep(2)
    
    def _navigate_to_tab(self, table_key: str):
        """Navigate to the appropriate tab for the table"""
        if table_key not in self.EXPORT_TABLES:
            return False
            
        table_info = self.EXPORT_TABLES[table_key]
        tab_text = table_info['tab_text']
        
        logger.info(f"Looking for tab: {tab_text}")
        
        # Try multiple strategies to find and click the tab
        tab_selectors = [
            f"//a[contains(text(), '{tab_text}')]",
            f"//span[contains(text(), '{tab_text}')]",
            f"//*[contains(text(), '{tab_text}') and contains(@href, 'Tab')]",
            f"//a[contains(@id, 'Tab') and contains(text(), '{tab_text.split()[0]}')]"
        ]
        
        for selector in tab_selectors:
            try:
                elements = self.driver.find_elements(By.XPATH, selector)
                for element in elements:
                    if element.is_displayed() and tab_text.lower() in element.text.lower():
                        logger.info(f"Clicking tab: {element.text}")
                        
                        # Scroll element into view
                        self.driver.execute_script("arguments[0].scrollIntoView(true);", element)
                        time.sleep(1)
                        
                        # Try clicking
                        try:
                            element.click()
                        except:
                            # If regular click fails, try JavaScript click
                            self.driver.execute_script("arguments[0].click();", element)
                        
                        time.sleep(3)  # Wait for tab content to load
                        logger.info(f"Successfully clicked tab for {tab_text}")
                        return True
                        
            except Exception as e:
                logger.debug(f"Tab selector {selector} failed: {e}")
                continue
        
        logger.warning(f"Could not find or click tab for {tab_text}")
        return False
    
    def _find_and_click_export_button(self, table_info: Dict[str, str]):
        """Find and click the export button for the current tab"""
        logger.info("Looking for export button...")
        
        # Get count of files before export
        initial_files = set(self.download_dir.glob("*.xlsx"))
        initial_files.update(self.download_dir.glob("*.xls"))
        
        # Try multiple selectors for the export button
        export_selectors = [
            "//input[@value='Export to Excel']",
            "//input[@id='btnExport']",
            "//button[contains(text(), 'Export')]",
            "//a[contains(@onclick, 'Export')]",
            f"//a[contains(@onclick, '{table_info['id']}')]",
            "//input[@type='button' and contains(@value, 'Export')]",
            "//input[contains(@onclick, 'Export')]"
        ]
        
        export_clicked = False
        for selector in export_selectors:
            try:
                elements = self.driver.find_elements(By.XPATH, selector)
                for element in elements:
                    if element.is_displayed() and element.is_enabled():
                        logger.info(f"Found export button: {element.get_attribute('outerHTML')[:100]}...")
                        
                        # Scroll into view
                        self.driver.execute_script("arguments[0].scrollIntoView(true);", element)
                        time.sleep(1)
                        
                        # Try clicking
                        try:
                            element.click()
                        except:
                            self.driver.execute_script("arguments[0].click();", element)
                        
                        export_clicked = True
                        logger.info("Export button clicked")
                        break
                
                if export_clicked:
                    break
                    
            except Exception as e:
                logger.debug(f"Export selector {selector} failed: {e}")
                continue
        
        if not export_clicked:
            logger.error("Could not find or click export button")
            # Save page source for debugging
            debug_file = self.download_dir / f"debug_page_source_{int(time.time())}.html"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
            logger.info(f"Saved page source to {debug_file} for debugging")
            return None
        
        # Wait for download to complete
        logger.info("Waiting for download to complete...")
        download_timeout = 45  # Increased timeout
        
        for i in range(download_timeout):
            time.sleep(1)
            current_files = set(self.download_dir.glob("*.xlsx"))
            current_files.update(self.download_dir.glob("*.xls"))
            new_files = current_files - initial_files
            
            if new_files:
                # Get the most recent file
                latest_file = max(new_files, key=lambda f: f.stat().st_mtime)
                file_size = latest_file.stat().st_size
                
                # Wait a bit more to ensure download is complete
                time.sleep(2)
                new_size = latest_file.stat().st_size
                
                if new_size == file_size and file_size > 0:  # File size stabilized
                    logger.info(f"Successfully downloaded: {latest_file} ({file_size} bytes)")
                    return str(latest_file)
        
        logger.error("Download timeout - no new Excel file appeared")
        return None
    
    def export_table(self, table_key: str, filters: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """
        Export a specific table
        
        Args:
            table_key: Key from EXPORT_TABLES dict
            filters: Optional filters to apply
            
        Returns:
            Path to downloaded file if successful, None otherwise
        """
        if table_key not in self.EXPORT_TABLES:
            logger.error(f"Unknown table key: {table_key}. Available: {list(self.EXPORT_TABLES.keys())}")
            return None
        
        table_info = self.EXPORT_TABLES[table_key]
        logger.info(f"Starting export of {table_info['description']}")
        
        try:
            # Setup browser if not already done
            if not self.driver:
                self._setup_driver()
            
            # Navigate to the report page
            self._navigate_to_report()
            
            # Apply filters if provided
            if filters:
                self._apply_filters(filters)
            
            # Navigate to the appropriate tab
            if not self._navigate_to_tab(table_key):
                logger.warning(f"Could not navigate to tab for {table_key}, continuing anyway...")
            
            # Find and click export button
            filepath = self._find_and_click_export_button(table_info)
            
            if filepath:
                logger.info(f"✓ Successfully exported {table_key} to: {filepath}")
            else:
                logger.error(f"✗ Failed to export {table_key}")
            
            return filepath
            
        except Exception as e:
            logger.error(f"Error exporting {table_key}: {e}")
            return None
    
    def export_all_tables(self, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Optional[str]]:
        """
        Export all available tables
        
        Args:
            filters: Optional filters to apply to all exports
            
        Returns:
            Dictionary mapping table keys to downloaded file paths
        """
        results = {}
        
        logger.info("Starting export of all tables")
        
        for table_key in self.EXPORT_TABLES:
            logger.info(f"Exporting {table_key}...")
            filepath = self.export_table(table_key, filters)
            results[table_key] = filepath
            
            if filepath:
                logger.info(f"✓ {table_key}: {filepath}")
            else:
                logger.error(f"✗ Failed to export {table_key}")
            
            # Brief pause between exports
            time.sleep(3)
        
        return results
    
    def list_available_tables(self):
        """Print available tables"""
        print("\nAvailable tables:")
        print("-" * 70)
        for key, info in self.EXPORT_TABLES.items():
            print(f"{key:20} - {info['description']}")
        print()
    
    def close(self):
        """Close the browser"""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("Browser closed")
            except:
                pass
            self.driver = None
    
    def __enter__(self):
        """Context manager entry"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()


def main():
    """Example usage"""
    with MassDORDataExporter(headless=True) as exporter:
        # List available tables
        exporter.list_available_tables()
        
        print("Exporting Revenue by Source data...")
        filepath = exporter.export_table('revenues_by_source')
        
        if filepath:
            print(f"Successfully exported to: {filepath}")
        else:
            print("Export failed")


if __name__ == "__main__":
    main()
