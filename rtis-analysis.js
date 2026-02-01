    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const DEFAULT_MAX_SPEED = 130;
            const COLOCATED_TOLERANCE_METERS = 50;
            const DETAIL_TIME_WINDOW_MINUTES = 10;
            const MAX_SIGNAL_DISTANCE_METERS = 30;

            let originalRtisData, cautionData, signalData, bulkData;
            let allLocations, speedChart, first30MinChart, magnifiedSpeedChart, stoppingAnalysisChart, homeSignalsAnalysisChart, brakeFeel600Chart, brakePowerChart;
            let speedViolations = [], brakingExceptions = [], allLabels = [], allSpeedData = [], allMaxSpeedData = [], allTimestamps = [], signalEvents = [], bulkMatchEvents = [];
            let stoppingAnalysisStops = [], homeSignalsStops = [];
            
            // Store additional brake pattern graph instances
            let additionalBrakeCharts = [];
            let brakeGraphCounter = 0;
            let brakeChartDataCache = null;
            
            // Route data for signal filtering
            let routeData = [];
            let selectedRouteData = null;
            
            // URL decode helper (obfuscated for security)
            const _0x = (s) => atob(s.split('').map(c => String.fromCharCode(c.charCodeAt(0) - 3)).join(''));
            
            // Data source references (encoded)
            const _s1 = 'dKU3fKP9O|<|\\[fx]5o3dKYlg[QofpQyeqUoeqTx\\5<wO4QkeqUre6QrTpIx\\Z{kO4QTWV4SUn]MT3XyfpYpf|<r]ZInf|<w\\ZoxO3oxfKY3OXLoPmEJX3ToPmEH\\[UkOpQ}gj@@';
            const SIGNAL_DATA_URL = _0x(_s1);
            
            // Function to load Signal Data from URL
            async function loadSignalDataFromGDrive(url) {
                const statusEl = document.getElementById('gdrive-signal-status');
                
                if (!url || url.trim() === '') {
                    statusEl.innerHTML = 'No URL provided. Please upload signal file manually.';
                    statusEl.className = 'mt-2 text-xs text-yellow-600';
                    return false;
                }
                
                statusEl.textContent = 'Loading signal data...';
                statusEl.className = 'mt-2 text-xs text-blue-600';
                
                try {
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const csvText = await response.text();
                    
                    if (!csvText || csvText.trim() === '') {
                        throw new Error('Empty response received');
                    }
                    
                    // Parse CSV using PapaParse
                    const result = Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: true
                    });
                    
                    if (result.errors && result.errors.length > 0) {
                        console.warn('CSV parsing warnings:', result.errors);
                    }
                    
                    if (!result.data || result.data.length === 0) {
                        throw new Error('No data found in CSV');
                    }
                    
                    // Verify it's signal data by checking headers
                    const headers = Object.keys(result.data[0]).map(h => h.toLowerCase().trim());
                    const isSignalData = headers.includes('designation of stop signal') || 
                                        headers.includes('type') || 
                                        headers.includes('latitude') || 
                                        headers.includes('longitude');
                    
                    if (!isSignalData) {
                        throw new Error('CSV does not appear to be signal data.');
                    }
                    
                    // Success! Set the global signalData variable
                    signalData = result.data;
                    
                    statusEl.textContent = `✓ Loaded ${signalData.length} signal records automatically`;
                    statusEl.className = 'mt-2 text-xs text-green-600';
                    
                    // Show route selection section since signal data is now available
                    routeSelectionSection.classList.remove('hidden');
                    
                    return true;
                    
                } catch (error) {
                    console.error('Error loading signal data:', error);
                    statusEl.innerHTML = `
                        <span class="text-red-600">⚠ Could not auto-load signal data: ${error.message}</span><br>
                        <span class="text-gray-600">Please upload the Signal CSV file manually using the file upload area above.</span>
                    `;
                    statusEl.className = 'mt-2 text-xs';
                    return false;
                }
            }

            const fileInput = document.getElementById('file-input');
            const fileDropArea = document.getElementById('file-drop-area');
            const fileList = document.getElementById('file-list');
            const fileClickTrigger = document.getElementById('file-click-trigger');
            const infoBox = document.getElementById('info-box');
            const headerList = document.getElementById('header-list');
            const loadingContainer = document.getElementById('loading-container');
            const outputSections = document.getElementById('output-sections');
            const magnifiedChartContainer = document.getElementById('magnified-chart-container');
            const messageBox = document.getElementById('message-box');
            const messageTitle = document.getElementById('message-title');
            const messageContent = document.getElementById('message-content');
            const closeMessage = document.getElementById('close-message');
            const violationsContainer = document.getElementById('violations-container');
            const violationsTableBody = document.getElementById('violations-table-body');
            const resetZoomButton = document.getElementById('reset-zoom');
            const printReportButton = document.getElementById('print-report');
            const stoppageLegend = document.getElementById('stoppage-legend');
            const stationSelectionSection = document.getElementById('station-selection-section');
            const startStationSelect = document.getElementById('start-station');
            const endStationSelect = document.getElementById('end-station');
            const startTimeOverride = document.getElementById('start-time-override');
            const endTimeOverride = document.getElementById('end-time-override');
            const runAnalysisBtn = document.getElementById('run-analysis');
            const brakingExceptionsContainer = document.getElementById('braking-exceptions-container');
            const brakingExceptionsTableBody = document.getElementById('braking-exceptions-table-body');
            const tripDetailsSection = document.getElementById('trip-details-section');
            const tripDetailsContent = document.getElementById('trip-details-content');
            const signalAnalysisContainer = document.getElementById('signal-analysis-container');
            const signalTableBody = document.getElementById('signal-table-body');


            const bulkMatchContainer = document.getElementById('bulk-match-container');
            const bulkMatchTableBody = document.getElementById('bulk-match-table-body');

            const directionSelectWrapper = document.getElementById('direction-select-wrapper');
            
            // Route selection elements
            const routeSelectionSection = document.getElementById('route-selection-section');
            const routeSearchInput = document.getElementById('route-search-input');
            const routeDropdownList = document.getElementById('route-dropdown-list');
            const routeClearBtn = document.getElementById('route-clear-btn');
            const selectedRouteInput = document.getElementById('selected-route');
            const routeSectionIdsDiv = document.getElementById('route-section-ids');
            const routeLoadStatus = document.getElementById('route-load-status');

            // Route data source (encoded)
            const _r1 = 'dKU3fKP9O|<|\\[fx]5o3dKYlg[QofpQyeqUoeqTx\\5<wO4QkeqUre6QrTpIx\\Z{kO4QTWV4SUn]MT3XyfpYpf|<r]ZInf|<w\\ZoxO4Myg[UoXJI3dKPx\\6Q5';
            const ROUTE_DATA_URL = _0x(_r1);
            
            // Load route data from source
            async function loadRouteData() {
                routeLoadStatus.textContent = 'Loading route data...';
                routeLoadStatus.className = 'mt-2 text-xs text-blue-600';
                
                try {
                    const response = await fetch(ROUTE_DATA_URL);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const csvText = await response.text();
                    
                    if (!csvText || csvText.trim() === '') {
                        throw new Error('Empty response received');
                    }

                    const result = Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: true
                    });
                    
                    if (result.errors && result.errors.length > 0) {
                        console.warn('CSV parsing warnings:', result.errors);
                    }

                    routeData = result.data.map(row => ({
                        route: row.Route || '',
                        path: row.Path || '',
                        sectionIds: (row.SectionIds || '').split(',').map(id => id.trim()).filter(id => id)
                    })).filter(r => r.route);

                    routeLoadStatus.textContent = `✓ Loaded ${routeData.length} routes`;
                    routeLoadStatus.className = 'mt-2 text-xs text-green-600';
                    populateRouteDropdown();
                } catch (error) {
                    console.error('Error loading route data:', error);
                    routeLoadStatus.innerHTML = `
                        <span class="text-red-600">⚠ Could not load route data: ${error.message}</span><br>
                        <span class="text-gray-600">Route selection will not be available.</span>
                    `;
                    routeLoadStatus.className = 'mt-2 text-xs';
                }
            }

            function populateRouteDropdown(filter = '') {
                routeDropdownList.innerHTML = '';
                const filterLower = filter.toLowerCase();
                
                const filteredRoutes = routeData.filter(r => 
                    r.route.toLowerCase().includes(filterLower) || 
                    r.path.toLowerCase().includes(filterLower)
                );

                if (filteredRoutes.length === 0) {
                    const noResult = document.createElement('div');
                    noResult.className = 'route-dropdown-item';
                    noResult.textContent = 'No routes found';
                    noResult.style.color = '#9ca3af';
                    noResult.style.cursor = 'default';
                    routeDropdownList.appendChild(noResult);
                    return;
                }

                filteredRoutes.forEach(route => {
                    const item = document.createElement('div');
                    item.className = 'route-dropdown-item';
                    if (selectedRouteInput.value === route.route) {
                        item.classList.add('selected');
                    }
                    item.innerHTML = `
                        <div class="route-info">
                            <span class="route-name">${route.route}</span>
                            <span class="route-path">${route.path}</span>
                        </div>
                    `;
                    item.addEventListener('click', () => selectRoute(route));
                    routeDropdownList.appendChild(item);
                });
            }

            function selectRoute(route) {
                selectedRouteInput.value = route.route;
                selectedRouteData = route;
                routeSearchInput.value = route.route;
                routeSectionIdsDiv.innerHTML = `<span class="font-medium text-indigo-700">${route.path}</span>`;
                routeDropdownList.classList.remove('show');
                routeClearBtn.classList.remove('hidden');
                
                // Update dropdown to show selection
                populateRouteDropdown(routeSearchInput.value);
            }

            function clearRouteSelection() {
                selectedRouteInput.value = '';
                selectedRouteData = null;
                routeSearchInput.value = '';
                routeSectionIdsDiv.innerHTML = '<span class="text-gray-400">No route selected</span>';
                routeClearBtn.classList.add('hidden');
                populateRouteDropdown();
            }

            // Check if signal matches selected route's SectionIds
            function isSignalInSelectedRoute(signal) {
                if (!selectedRouteData || !selectedRouteData.sectionIds || selectedRouteData.sectionIds.length === 0) {
                    return true; // No route selected, include all signals
                }
                
                // Find the SectionId key in signal data
                const sectionIdKey = findKey(signal, ['SectionId', 'Section Id', 'Section_Id', 'sectionid', 'SECTIONID']);
                if (!sectionIdKey) {
                    return true; // No SectionId field, include by default
                }
                
                const signalSectionId = String(signal[sectionIdKey] || '').trim();
                if (!signalSectionId) {
                    return true; // Empty SectionId, include by default
                }
                
                return selectedRouteData.sectionIds.includes(signalSectionId);
            }

            // Route search input event listeners
            routeSearchInput.addEventListener('focus', () => {
                routeDropdownList.classList.add('show');
                populateRouteDropdown(routeSearchInput.value);
            });

            routeSearchInput.addEventListener('input', (e) => {
                populateRouteDropdown(e.target.value);
                routeDropdownList.classList.add('show');
            });

            routeClearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                clearRouteSelection();
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!routeSearchInput.contains(e.target) && !routeDropdownList.contains(e.target) && !routeClearBtn.contains(e.target)) {
                    routeDropdownList.classList.remove('show');
                }
            });

            // Load route data on page load
            loadRouteData();
            
            // Auto-load signal data from GitHub on page load
            (async () => {
                await loadSignalDataFromGDrive(SIGNAL_DATA_URL);
            })();

            fileClickTrigger.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (event) => handleFileSelect(event.target.files));
            ['dragover', 'dragenter'].forEach(e => fileDropArea.addEventListener(e, (ev) => { ev.preventDefault(); fileDropArea.classList.add('border-blue-500', 'bg-blue-50'); }));
            ['dragleave', 'drop'].forEach(e => fileDropArea.addEventListener(e, (ev) => { ev.preventDefault(); fileDropArea.classList.remove('border-blue-500', 'bg-blue-50'); }));
            fileDropArea.addEventListener('drop', (event) => handleFileSelect(event.dataTransfer.files));
            closeMessage.addEventListener('click', () => messageBox.classList.add('hidden'));
            resetZoomButton.addEventListener('click', () => magnifiedChartContainer.classList.add('hidden'));
            printReportButton.addEventListener('click', () => window.print());

            // Main report print orientation buttons
            const printReportPortraitBtn = document.getElementById('print-report-portrait');
            const printReportLandscapeBtn = document.getElementById('print-report-landscape');

            // Create a separate style element for main report orientation
            const mainReportOrientationStyle = document.createElement('style');
            mainReportOrientationStyle.id = 'main-report-orientation-style';
            mainReportOrientationStyle.innerHTML = `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0.3cm;
                    }
                }
            `;
            document.head.appendChild(mainReportOrientationStyle);

            function updateMainReportPageOrientation(isLandscape) {
                if (isLandscape) {
                    mainReportOrientationStyle.innerHTML = `
                        @media print {
                            @page {
                                size: A4 landscape;
                                margin: 0.3cm;
                            }
                        }
                    `;
                } else {
                    mainReportOrientationStyle.innerHTML = `
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 0.3cm;
                            }
                        }
                    `;
                }
            }

            // Set portrait as default active for main report
            if (printReportPortraitBtn) {
                printReportPortraitBtn.classList.add('active');
                printReportPortraitBtn.addEventListener('click', () => {
                    updateMainReportPageOrientation(false);
                    printReportPortraitBtn.classList.add('active');
                    printReportLandscapeBtn.classList.remove('active');
                });
            }

            if (printReportLandscapeBtn) {
                printReportLandscapeBtn.addEventListener('click', () => {
                    updateMainReportPageOrientation(true);
                    printReportLandscapeBtn.classList.add('active');
                    printReportPortraitBtn.classList.remove('active');
                });
            }

            // Zoom buttons for Full Run Profile chart
            const zoomInBtn = document.getElementById('zoom-in-btn');
            const zoomOutBtn = document.getElementById('zoom-out-btn');
            const zoomResetBtn = document.getElementById('zoom-reset-btn');

            if (zoomInBtn && zoomOutBtn && zoomResetBtn) {
                zoomInBtn.addEventListener('click', () => {
                    if (speedChart) speedChart.zoom(1.2);
                });
                zoomOutBtn.addEventListener('click', () => {
                    if (speedChart) speedChart.zoom(0.8);
                });
                zoomResetBtn.addEventListener('click', () => {
                    if (speedChart) speedChart.resetZoom();
                });
            }

            // Zoom buttons for First 30 Minutes chart
            const zoomInBtnFirst30 = document.getElementById('zoom-in-btn-first30');
            const zoomOutBtnFirst30 = document.getElementById('zoom-out-btn-first30');
            const zoomResetBtnFirst30 = document.getElementById('zoom-reset-btn-first30');

            if (zoomInBtnFirst30 && zoomOutBtnFirst30 && zoomResetBtnFirst30) {
                zoomInBtnFirst30.addEventListener('click', () => {
                    if (first30MinChart) first30MinChart.zoom(1.2);
                });
                zoomOutBtnFirst30.addEventListener('click', () => {
                    if (first30MinChart) first30MinChart.zoom(0.8);
                });
                zoomResetBtnFirst30.addEventListener('click', () => {
                    if (first30MinChart) first30MinChart.resetZoom();
                });
            }

            const printBrakeBtn = document.getElementById('print-brake-analysis');
            if (printBrakeBtn) {
                printBrakeBtn.addEventListener('click', printBrakeAnalysis);
            }

            // Print orientation buttons for Brake Analysis
            const portraitBtn = document.getElementById('print-orientation-portrait');
            const landscapeBtn = document.getElementById('print-orientation-landscape');

            // Create a style element for landscape printing that can be dynamically updated
            const orientationStyle = document.createElement('style');
            orientationStyle.id = 'orientation-style';
            document.head.appendChild(orientationStyle);

            function updateBrakePageOrientation(isLandscape) {
                if (isLandscape) {
                    orientationStyle.innerHTML = `
                        @media print {
                            @page {
                                size: A4 landscape;
                                margin: 0.3cm;
                            }
                        }
                    `;
                } else {
                    orientationStyle.innerHTML = `
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 0.3cm;
                            }
                        }
                    `;
                }
            }

            // Set portrait as default active
            if (portraitBtn) {
                portraitBtn.classList.add('active');
                portraitBtn.addEventListener('click', () => {
                    updateBrakePageOrientation(false);
                    portraitBtn.classList.add('active');
                    landscapeBtn.classList.remove('active');
                });
            }

            if (landscapeBtn) {
                landscapeBtn.addEventListener('click', () => {
                    updateBrakePageOrientation(true);
                    landscapeBtn.classList.add('active');
                    portraitBtn.classList.remove('active');
                });
            }

            const populateSpeedAnalysisBtn = document.getElementById('populate-speed-analysis');
            if (populateSpeedAnalysisBtn) {
                populateSpeedAnalysisBtn.addEventListener('click', populateSpeedAnalysisTable);
            }
            
            // Add Graph button for brake pattern analysis
            const addBrakeGraphBtn = document.getElementById('add-brake-graph-btn');
            if (addBrakeGraphBtn) {
                addBrakeGraphBtn.addEventListener('click', createAdditionalBrakeGraph);
            }
            
            runAnalysisBtn.addEventListener('click', runAnalysis);

            // Auto-format date-time inputs to DD-MM-YYYY HH:MM:SS
            function autoFormatDateTime(input) {
                let value = input.value.replace(/\D/g, ''); // Remove non-digits
                if (value.length > 14) value = value.slice(0, 14); // Max 14 digits
                
                let formatted = '';
                
                // DD
                if (value.length >= 1) {
                    formatted += value.slice(0, 2);
                }
                // -MM
                if (value.length >= 3) {
                    formatted += '-' + value.slice(2, 4);
                }
                // -YYYY
                if (value.length >= 5) {
                    formatted += '-' + value.slice(4, 8);
                }
                // (space)HH
                if (value.length >= 9) {
                    formatted += ' ' + value.slice(8, 10);
                }
                // :MM
                if (value.length >= 11) {
                    formatted += ':' + value.slice(10, 12);
                }
                // :SS
                if (value.length >= 13) {
                    formatted += ':' + value.slice(12, 14);
                }
                
                input.value = formatted;
            }

            startTimeOverride.addEventListener('input', () => autoFormatDateTime(startTimeOverride));
            endTimeOverride.addEventListener('input', () => autoFormatDateTime(endTimeOverride));

            function showMessage(title, content) {
                messageTitle.textContent = title;
                messageContent.textContent = content;
                messageBox.classList.remove('hidden');
            }

            function populateSpeedAnalysisTable() {
                const speedTable = document.getElementById('brakeAnalysisSpeedTable');
                console.log('speedTable:', speedTable);
                if (!speedTable) return;

                const tbody = speedTable.querySelector('tbody');
                console.log('tbody:', tbody);
                if (!tbody) return;

                // Use the global stoppingAnalysisStops array - includes ALL stations from Brake Analysis graph
                if (!stoppingAnalysisStops || stoppingAnalysisStops.length === 0) {
                    showMessage('Info', 'No stop data available. Please generate the Braking Pattern Analysis chart first.');
                    return;
                }

                // Get ALL stations from the Brake Analysis (no filtering by legend visibility)
                const selectedStations = stoppingAnalysisStops.map(stop => stop.station);
                console.log('ALL stations from Brake Analysis:', selectedStations);

                if (selectedStations.length === 0) {
                    showMessage('Info', 'No valid station data found.');
                    return;
                }

                // Clear existing rows except the first one
                const rows = tbody.querySelectorAll('tr');
                console.log('Clearing rows, current count:', rows.length);
                rows.forEach((row, index) => {
                    if (index > 0) row.remove();
                });

                // Get the first row and fill it with the first station
                const firstRow = tbody.querySelector('tr');
                console.log('firstRow:', firstRow);
                if (firstRow) {
                    const textareas = firstRow.querySelectorAll('textarea');
                    console.log('textareas in firstRow:', textareas.length);
                    if (textareas.length >= 6) {
                        textareas[0].value = '0'; // S No
                        textareas[0].style.textAlign = 'center';
                        textareas[1].value = selectedStations[0]; // Station
                        textareas[1].style.textAlign = 'center';
                        textareas[2].value = ''; // Speed at Double Yellow - user will fill
                        textareas[2].style.textAlign = 'center';
                        textareas[3].value = ''; // Speed at Single Yellow - user will fill
                        textareas[3].style.textAlign = 'center';
                        textareas[4].value = 'NA'; // Cross over speed default
                        textareas[4].style.textAlign = 'center';
                        textareas[5].value = 'NIL'; // Remarks default
                        textareas[5].style.textAlign = 'center';
                        console.log('First row filled with station:', selectedStations[0]);
                    }
                }

                // Add rows for remaining stations
                console.log('Adding', selectedStations.length - 1, 'rows');
                for (let i = 1; i < selectedStations.length; i++) {
                    const newRow = document.createElement('tr');
                    newRow.innerHTML = `
                        <td><textarea style="text-align: center;">${i}</textarea></td>
                        <td><textarea style="text-align: center;">${selectedStations[i]}</textarea></td>
                        <td><textarea style="text-align: center;">YY</textarea></td>
                        <td><textarea style="text-align: center;"></textarea></td>
                        <td><textarea style="text-align: center;">Y</textarea></td>
                        <td><textarea style="text-align: center;"></textarea></td>
                        <td><textarea style="text-align: center;">NA</textarea></td>
                        <td><textarea style="text-align: center;">NIL</textarea></td>
                        <td>
                            <div class="flex justify-center items-center space-x-1">
                                <button type="button" class="add-row text-green-600 text-lg font-bold hover:text-green-800">+</button>
                                <button type="button" class="remove-row text-red-600 text-lg font-bold hover:text-red-800">&minus;</button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(newRow);
                    console.log('Added row', i, 'with station:', selectedStations[i]);

                    // Attach event listeners to the new buttons
                    const addBtn = newRow.querySelector('.add-row');
                    const removeBtn = newRow.querySelector('.remove-row');
                    
                    if (addBtn) {
                        addBtn.addEventListener('click', function() {
                            const newRow = this.closest('tr').cloneNode(true);
                            this.closest('tr').after(newRow);
                            attachRowButtonListeners(newRow);
                        });
                    }
                    
                    if (removeBtn) {
                        removeBtn.addEventListener('click', function() {
                            this.closest('tr').remove();
                        });
                    }
                }

                // Attach listeners to existing buttons in first row
                const addBtnFirst = firstRow.querySelector('.add-row');
                const removeBtnFirst = firstRow.querySelector('.remove-row');
                
                if (addBtnFirst) {
                    addBtnFirst.addEventListener('click', function() {
                        const newRow = this.closest('tr').cloneNode(true);
                        this.closest('tr').after(newRow);
                        attachRowButtonListeners(newRow);
                    });
                }
                
                if (removeBtnFirst) {
                    removeBtnFirst.addEventListener('click', function() {
                        this.closest('tr').remove();
                    });
                }

                console.log('Populate complete. Total rows now:', tbody.querySelectorAll('tr').length);
                showMessage('Success', `Table populated with ${selectedStations.length} station(s) from Brake Analysis`);
            }

            function attachRowButtonListeners(row) {
                const addBtn = row.querySelector('.add-row');
                const removeBtn = row.querySelector('.remove-row');
                
                if (addBtn) {
                    addBtn.removeEventListener('click', null);
                    addBtn.addEventListener('click', function() {
                        const newRow = this.closest('tr').cloneNode(true);
                        this.closest('tr').after(newRow);
                        attachRowButtonListeners(newRow);
                    });
                }
                
                if (removeBtn) {
                    removeBtn.removeEventListener('click', null);
                    removeBtn.addEventListener('click', function() {
                        this.closest('tr').remove();
                    });
                }
            }

            function printBrakeAnalysis() {
                console.log('Print brake analysis clicked');
                // Get all sections
                const outputSections = document.getElementById('output-sections');
                const brakingPatternSection = document.getElementById('braking-pattern-section');
                const brakingExceptionsContainer = document.getElementById('braking-exceptions-container');
                
                console.log('Output sections:', outputSections);
                console.log('Braking pattern section:', brakingPatternSection);
                console.log('Braking exceptions:', brakingExceptionsContainer);
                
                if (!outputSections || !brakingPatternSection) {
                    console.error('Missing required elements');
                    return;
                }
                
                // Store original states
                const originalOutputState = outputSections.style.display;
                const originalExceptionsState = brakingExceptionsContainer ? brakingExceptionsContainer.style.display : 'hidden';
                
                // Add brake-analysis-print class to hide headers and trip details
                document.body.classList.add('brake-analysis-print');
                
                // Show the braking exceptions container
                if (brakingExceptionsContainer) {
                    brakingExceptionsContainer.style.display = '';
                }
                
                // Show only the braking pattern section by hiding output-sections and showing just the pattern
                const allElements = outputSections.querySelectorAll(':scope > div');
                const elementsStates = [];
                
                allElements.forEach(element => {
                    const originalState = element.style.display;
                    elementsStates.push({ element, originalState });
                    if (element !== brakingPatternSection) {
                        element.style.display = 'none';
                    }
                });
                
                console.log('Hiding', allElements.length - 1, 'elements');
                
                // Trigger print
                setTimeout(() => {
                    window.print();
                    
                    // Restore original states after print
                    setTimeout(() => {
                        document.body.classList.remove('brake-analysis-print');
                        elementsStates.forEach(({ element, originalState }) => {
                            element.style.display = originalState;
                        });
                        if (brakingExceptionsContainer) {
                            brakingExceptionsContainer.style.display = originalExceptionsState;
                        }
                        console.log('States restored');
                    }, 100);
                }, 100);
            }

            // *** TIME FORMATTER ***
            function formatTime(date) {
                if (!date || isNaN(date.getTime())) {
                    return null;
                }
                const h = String(date.getHours()).padStart(2, '0');
                const m = String(date.getMinutes()).padStart(2, '0');
                const s = String(date.getSeconds()).padStart(2, '0');
                return `${h}:${m}:${s}`;
            }

            // *** DATE+TIME FORMATTER for unique keys ***
            function formatDateTime(date) {
                if (!date || isNaN(date.getTime())) return null;
                const y = date.getFullYear();
                const mo = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                const h = String(date.getHours()).padStart(2, '0');
                const m = String(date.getMinutes()).padStart(2, '0');
                const s = String(date.getSeconds()).padStart(2, '0');
                return `${y}-${mo}-${d} ${h}:${m}:${s}`;
            }

            // *** FORMAT DATE+TIME as DD-MM-YYYY HH:MM:SS ***
            function formatDateTimeCustom(date) {
                if (!date || isNaN(date.getTime())) return null;
                const d = String(date.getDate()).padStart(2, '0');
                const mo = String(date.getMonth() + 1).padStart(2, '0');
                const y = date.getFullYear();
                const h = String(date.getHours()).padStart(2, '0');
                const m = String(date.getMinutes()).padStart(2, '0');
                const s = String(date.getSeconds()).padStart(2, '0');
                return `${d}-${mo}-${y} ${h}:${m}:${s}`;
            }

            function handleFileSelect(files) {
                if (files.length === 0 || files.length > 6) {
                    return showMessage("File Error", "Please upload 1 to 6 files.");
                }

                fileList.textContent = `Selected: ${Array.from(files).map(f => f.name).join(', ')}`;
                loadingContainer.classList.remove('hidden');
                outputSections.classList.add('hidden');
                infoBox.classList.add('hidden');
                stationSelectionSection.classList.add('hidden');
                tripDetailsSection.classList.add('hidden');
                signalAnalysisContainer.classList.add('hidden');
                directionSelectWrapper.classList.add('hidden');
                bulkMatchContainer.classList.add('hidden');

                // Preserve signalData if loaded from Google Drive and no local signal file is uploaded
                const preserveGdriveSignal = signalData && signalData.length > 0;
                originalRtisData = null; cautionData = null; bulkData = null;
                // Only reset signalData if a new signal file is being uploaded (checked later)
                let localSignalFileDetected = false;

                const filePromises = Array.from(files).map(file => new Promise((resolve, reject) => {
                    Papa.parse(file, {
                        // Check row 5 (index 4) for headers, but also Row 1 (index 0)
                        preview: 5,
                        complete: res => {
                            if (!res.data || res.data.length === 0) return resolve({ type: 'unknown', file });

                            let fileType = 'unknown';
                            let fileName = file.name;

                            try {
                                const headers_L1 = (res.data[0] || []).map(h => String(h || '').trim().toLowerCase());
                                if (headers_L1.includes('logging time') || headers_L1.includes('gps time')) {
                                    fileType = 'rtis';
                                } else if (headers_L1.includes('ohe mast from')) {
                                    fileType = 'caution';
                                } else if (headers_L1.includes('designation of stop signal') || headers_L1.includes('type')) {
                                    fileType = 'signal';
                                } else if (headers_L1.includes('device id') && headers_L1.includes('signal time') && headers_L1.includes('conclusion')) {
                                    fileType = 'bulk'; // Identified Bulk Violation Report
                                }
                            } catch (e) {
                                console.error("Error parsing headers: ", e);
                            }

                            if (fileType === 'rtis') {
                                resolve({ type: 'rtis', file, name: fileName });
                            } else {
                                resolve({ type: fileType, file });
                            }
                        },
                        error: reject
                    });
                }));

                Promise.all(filePromises).then(fileTypes => {
                    const rtisFileObj = fileTypes.find(f => f.type === 'rtis');
                    const cautionFile = fileTypes.find(f => f.type === 'caution')?.file;
                    const signalFile = fileTypes.find(f => f.type === 'signal')?.file;
                    const bulkFile = fileTypes.find(f => f.type === 'bulk')?.file;
                    
                    // If a local signal file is uploaded, it will override Google Drive signal data
                    if (signalFile) {
                        localSignalFileDetected = true;
                        signalData = null; // Reset to load from local file
                        // Update Google Drive status to indicate override
                        const gdriveStatus = document.getElementById('gdrive-signal-status');
                        if (gdriveStatus) {
                            gdriveStatus.textContent = 'Signal data will be loaded from local file (overrides Google Drive data)';
                            gdriveStatus.className = 'mt-2 text-xs text-yellow-600';
                        }
                    }

                    if (!rtisFileObj) {
                        loadingContainer.classList.add('hidden');
                        return showMessage("File Identification Error", "The required RTIS file is missing. Please check file headers.");
                    }

                    const rtisFile = rtisFileObj.file;
                    displayTripDetails(rtisFileObj.name);

                    // Create a list of promises for *standard* files
                    let standardFilePromises = [];
                    if (rtisFile) standardFilePromises.push(parseCSV(rtisFile).then(res => ({ name: 'rtis', ...res })));
                    if (cautionFile) standardFilePromises.push(parseCSV(cautionFile).then(res => ({ name: 'caution', ...res })));
                    if (signalFile) standardFilePromises.push(parseCSV(signalFile).then(res => ({ name: 'signal', ...res })));
                    if (bulkFile) standardFilePromises.push(parseCSV(bulkFile).then(res => ({ name: 'bulk', ...res })));

                    let allPromises = standardFilePromises;

                    Promise.all(allPromises)
                        .then(results => {
                            headerList.innerHTML = '';

                            results.forEach((result, index) => {
                                const fileType = result.name;
                                const headersStr = result.headers.join(', ');

                                if (fileType === 'rtis') {
                                    originalRtisData = result.data;
                                    headerList.innerHTML += `<li><b>RTIS:</b> ${headersStr}</li>`;
                                } else if (fileType === 'caution') {
                                    cautionData = result.data;
                                    headerList.innerHTML += `<li><b>Caution:</b> ${headersStr}</li>`;
                                } else if (fileType === 'signal') {
                                    signalData = result.data;
                                    headerList.innerHTML += `<li><b>Signal (Local):</b> ${headersStr}</li>`;
                                    // Update Google Drive status
                                    const gdriveStatus = document.getElementById('gdrive-signal-status');
                                    if (gdriveStatus) {
                                        gdriveStatus.textContent = `✓ Using local signal file (${signalData.length} records)`;
                                        gdriveStatus.className = 'mt-2 text-xs text-blue-600';
                                    }
                                } else if (fileType === 'bulk') {
                                    bulkData = result.data;
                                    headerList.innerHTML += `<li><b>Bulk Violations:</b> ${headersStr}</li>`;
                                }
                            });

                            infoBox.classList.remove('hidden');
                            populateStationSelectors();
                            loadingContainer.classList.add('hidden');
                            stationSelectionSection.classList.remove('hidden');
                            
                            // If signal data exists from Google Drive and no local signal file was loaded, show in header list
                            if (signalData && signalData.length > 0 && !localSignalFileDetected) {
                                const signalHeaders = Object.keys(signalData[0]).join(', ');
                                headerList.innerHTML += `<li><b>Signal:</b> ${signalHeaders}</li>`;
                            }
                            
                            // Show route selection section if signal file is loaded
                            if (signalData && signalData.length > 0) {
                                routeSelectionSection.classList.remove('hidden');
                            } else {
                                routeSelectionSection.classList.add('hidden');
                            }

                        }).catch(err => {
                            loadingContainer.classList.add('hidden');
                            showMessage("Parsing Error", "An error occurred during parsing: " + err.message);
                        });
                });
            }

            function displayTripDetails(fileName) {
                const parts = fileName.replace('.csv', '').replace(' - SPM', '').split('_');

                const details = {
                    'Train No.': parts[0],
                    'Loco No.': parts[1],
                    'LP Name': '',
                    'Designation': '',
                    'CMS ID': '',
                    'Section': '',
                    'Date': '',
                    'NLI': '',
                    'Load': '',
                    'Length': '',
                    'Departure': '',
                    'Arrival': ''
                };

                if (parts[0].includes('.')) {
                    details['Date'] = '';
                    details['Train No.'] = parts[0];
                    details['Loco No.'] = parts[1];
                    details['LP Name'] = '';
                    details['Designation'] = '';
                    details['CMS ID'] = '';
                    details['Section'] = '';
                    details['NLI'] = '';
                    details['Load'] = '';
                    details['Length'] = '';
                }

                tripDetailsContent.innerHTML = '';

                Object.entries(details).forEach(([key, value]) => {
                    // 👇 Render input for all fields (now including Train No. and Loco No.)
                    tripDetailsContent.innerHTML += `
                <div class="flex flex-col gap-0.5">
                    <label class="font-semibold text-gray-700 text-xs">${key}:</label>
                    <input
                        type="text"
                        id="${key.toLowerCase().replace(/\./g, '').replace(/\s/g, '-')}Input"
                        value="${value || ''}"
                        placeholder="Enter ${key}"
                        class="w-full rounded-md px-2 py-1.5 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                </div>
            `;
                });

                tripDetailsSection.classList.remove('hidden');
            }



            function populateStationSelectors() {
                if (!originalRtisData || originalRtisData.length === 0) return showMessage('Error', 'RTIS data is empty or invalid.');

                const possibleStationKeys = ['last/cur stationCode', 'stationCode', 'Station Code', 'Station', 'STATION'];
                const stationKey = findKey(originalRtisData[0], possibleStationKeys);

                const timeKey = findKey(originalRtisData[0], ['Logging Time']);
                const gpsTimeKey = findKey(originalRtisData[0], ['Gps Time']);
                const speedKey = findKey(originalRtisData[0], ['Speed']);

                if (!stationKey) return showMessage('Error', 'Could not find a valid station code column in RTIS file.');

                startStationSelect.innerHTML = '';
                endStationSelect.innerHTML = '';

                let lastStation = null;
                let lastTime = null;
                const LONG_STOP_MINUTES = 30;

                originalRtisData.forEach((row, index) => {
                    const currentStation = row[stationKey];
                    const logTime = parseTimestamp(row[gpsTimeKey], row[timeKey]);
                    if (!currentStation || isNaN(logTime.getTime())) return;

                    const addOption = (i) => {
                        const time = parseTimestamp(originalRtisData[i][gpsTimeKey], originalRtisData[i][timeKey]);
                        const optionText = `${originalRtisData[i][stationKey]} (${time.toLocaleString()})`;
                        startStationSelect.add(new Option(optionText, index));
                        endStationSelect.add(new Option(optionText, index));
                    };

                    if (currentStation !== lastStation) {
                        addOption(index);
                        lastStation = currentStation;
                        lastTime = logTime;
                    } else if (parseFloat(row[speedKey]) < 2) {
                        if (logTime.getTime() - lastTime.getTime() > LONG_STOP_MINUTES * 60 * 1000) {
                            addOption(index);
                            lastTime = logTime;
                        }
                    }
                });

                if (endStationSelect.options.length > 1) {
                    endStationSelect.selectedIndex = endStationSelect.options.length - 1;
                }
            }

            function runAnalysis() {
                const startIndex = parseInt(startStationSelect.value);
                const endIndex = parseInt(endStationSelect.value);

                if (isNaN(startIndex) || isNaN(endIndex)) return showMessage('Error', 'Invalid station selection.');
                if (startIndex >= endIndex) return showMessage('Error', 'The end station must appear after the start station in the log.');

                // Check for custom start time override
                const startTimeOverrideInput = document.getElementById('start-time-override').value.trim();
                let actualStartIndex = startIndex;

                if (startTimeOverrideInput) {
                    // User provided custom date-time, find the data point matching this time
                    const timeKey = findKey(originalRtisData[0], ['Logging Time']);
                    const gpsTimeKey = findKey(originalRtisData[0], ['Gps Time']);
                    
                    // Find the row in the dropdown range that matches the custom date-time
                    let foundIndex = -1;
                    for (let i = startIndex; i <= endIndex; i++) {
                        const time = parseTimestamp(originalRtisData[i][gpsTimeKey], originalRtisData[i][timeKey]);
                        const timeString = formatDateTimeCustom(time);
                        if (timeString === startTimeOverrideInput) {
                            foundIndex = i;
                            break;
                        }
                    }

                    if (foundIndex === -1) {
                        return showMessage('Error', `Start time ${startTimeOverrideInput} not found in the selected range. Please check the format (DD-MM-YYYY HH:MM:SS) and station range.`);
                    }

                    actualStartIndex = foundIndex;
                }

                // Check for custom end time override
                const endTimeOverrideInput = document.getElementById('end-time-override').value.trim();
                let actualEndIndex = endIndex;

                if (endTimeOverrideInput) {
                    // User provided custom date-time, find the data point matching this time
                    const timeKey = findKey(originalRtisData[0], ['Logging Time']);
                    const gpsTimeKey = findKey(originalRtisData[0], ['Gps Time']);
                    
                    // Find the row in the dropdown range that matches the custom date-time
                    let foundIndex = -1;
                    for (let i = endIndex; i >= startIndex; i--) {
                        const time = parseTimestamp(originalRtisData[i][gpsTimeKey], originalRtisData[i][timeKey]);
                        const timeString = formatDateTimeCustom(time);
                        if (timeString === endTimeOverrideInput) {
                            foundIndex = i;
                            break;
                        }
                    }

                    if (foundIndex === -1) {
                        return showMessage('Error', `End time ${endTimeOverrideInput} not found in the selected range. Please check the format (DD-MM-YYYY HH:MM:SS) and station range.`);
                    }

                    actualEndIndex = foundIndex;
                }

                if (actualStartIndex >= actualEndIndex) {
                    return showMessage('Error', 'Start time must be before end time.');
                }

                const rtisData = originalRtisData.slice(actualStartIndex, actualEndIndex + 1);

                const selectedDirection = document.getElementById('direction-select').value;

                loadingContainer.classList.remove('hidden');
                outputSections.classList.add('hidden');

                setTimeout(() => main(rtisData, selectedDirection), 50);
            }

            function parseCSV(file) {
                return new Promise((resolve, reject) => {
                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: true,
                        dynamicTyping: true,
                        skipRows: 0,
                        transformHeader: h => h.trim(),
                        complete: res => resolve({ headers: res.meta.fields, data: res.data }),
                        error: err => reject(err)
                    });
                });
            }

            function findKey(obj, possibleKeys) {
                if (!obj) return null;
                const keys = Object.keys(obj);

                for (const pKey of possibleKeys) {
                    const normalizedPKey = String(pKey).toLowerCase().replace(/[^a-z0-9]/g, '');
                    const foundKey = keys.find(k => String(k).toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedPKey);
                    if (foundKey) return foundKey;
                }

                for (const pKey of possibleKeys) {
                    const normalizedPKey = String(pKey).toLowerCase().replace(/[^a-z0-9]/g, '');
                    const foundKey = keys.find(k => String(k).toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedPKey));
                    if (foundKey) return foundKey;
                }
                return null;
            }

            function parseTimestamp(gpsTimeStr, loggingTimeStr) {
                let fullTimestampStr = String(gpsTimeStr);

                if (!fullTimestampStr || fullTimestampStr.trim() === '0' || fullTimestampStr.trim() === 'null' || fullTimestampStr.trim() === 'undefined') {
                    fullTimestampStr = String(loggingTimeStr);
                }
                if (!fullTimestampStr || fullTimestampStr.trim() === '0' || fullTimestampStr.trim() === 'null') {
                    return new Date('invalid');
                }

                let [datePart, timePart] = fullTimestampStr.split(' ');

                if (!timePart && datePart.includes(':')) {
                    timePart = datePart;
                    let gpsDate = String(gpsTimeStr).split(' ')[0];
                    if (gpsDate && !gpsDate.includes(':') && gpsDate.trim() !== '0') {
                        datePart = gpsDate;
                    } else {
                        let logDate = String(loggingTimeStr).split(' ')[0];
                        if (logDate && !logDate.includes(':') && logDate.trim() !== '0') {
                            datePart = logDate;
                        } else {
                            return new Date('invalid');
                        }
                    }
                }

                if (!datePart) return new Date('invalid');

                let year, month, day;
                if (datePart.includes('-')) {
                    const parts = datePart.split('-');
                    if (parts.length === 3) {
                        if (parts[0].length === 4) { [year, month, day] = parts; }
                        else { [day, month, year] = parts; }
                    }
                } else if (datePart.includes('/')) {
                    const parts = datePart.split('/');
                    if (parts.length === 3) { [day, month, year] = parts; } // Assumed DD/MM/YYYY for RTIS unless US format
                } else if (datePart.includes('.')) {
                    const parts = datePart.split('.');
                    if (parts.length === 3) { [day, month, year] = parts; }
                }
                if (year && year.length === 2) year = `20${year}`;

                const [hours, minutes, seconds] = (timePart || '00:00:00').split(':');
                return new Date(year, month - 1, day, hours, minutes, seconds);
            }

            // *** BULK FILE SPECIFIC PARSER ***
            function parseBulkTimestamp(timeStr) {
                if (!timeStr) return new Date('invalid');
                // Clean string
                timeStr = timeStr.trim();

                const parts = timeStr.split(',');
                if (parts.length < 2) return new Date('invalid');

                const datePart = parts[0].trim();
                const timePart = parts[1].trim();
                const dateSubParts = datePart.split('/');

                if (dateSubParts.length !== 3) return new Date('invalid');

                const isAMPM = /am|pm/i.test(timePart);

                let d, m, y, h, min, s;

                if (isAMPM) {
                    // Format: MM/DD/YYYY HH:MM:SS AM/PM (US Style)
                    [m, d, y] = dateSubParts.map(Number);

                    const timeMatches = timePart.match(/(\d+):(\d+):(\d+)\s*(am|pm)/i);
                    if (timeMatches) {
                        h = parseInt(timeMatches[1], 10);
                        min = parseInt(timeMatches[2], 10);
                        s = parseInt(timeMatches[3], 10);
                        const meridian = timeMatches[4].toLowerCase();
                        if (meridian === 'pm' && h < 12) h += 12;
                        if (meridian === 'am' && h === 12) h = 0;
                    } else {
                        return new Date('invalid');
                    }
                } else {
                    // Format: DD/MM/YYYY HH:MM:SS (International Style)
                    [d, m, y] = dateSubParts.map(Number);
                    [h, min, s] = timePart.split(':').map(Number);
                }

                if (y < 100) y += 2000; // Handle 2-digit years if any

                return new Date(y, m - 1, d, h, min, s);
            }

            function normalizeStationCode(stationStr) {
                if (!stationStr) return '';
                return String(stationStr).split('_')[0].split('-')[0].trim();
            }

            function processBulkData(bulkData) {
                const bulkLookup = new Map();
                if (!bulkData || bulkData.length === 0) return bulkLookup;

                const idKey = findKey(bulkData[0], ['Device Id']);
                const stationKey = findKey(bulkData[0], ['Station']);
                // *** UPDATED: Using 'Signal Time' instead of 'Event Time' ***
                const timeKey = findKey(bulkData[0], ['Signal Time']);
                const speedKey = findKey(bulkData[0], ['Speed']);

                if (!idKey || !stationKey || !timeKey) {
                    showMessage("Bulk File Error", "Missing columns: Device Id, Station, or Signal Time.");
                    return bulkLookup;
                }

                bulkData.forEach(row => {
                    const id = String(row[idKey] || '').trim();
                    const station = normalizeStationCode(row[stationKey]);
                    const timeStr = String(row[timeKey] || '');
                    const speed = row[speedKey];

                    const dateObj = parseBulkTimestamp(timeStr);
                    if (isNaN(dateObj.getTime())) return;

                    const dateTimeKey = formatDateTime(dateObj);
                    if (!dateTimeKey) return;

                    // KEY: DeviceID_Station_DateTime (Where DateTime is Signal Time)
                    const key = `${id}_${station}_${dateTimeKey}`;
                    bulkLookup.set(key, { speed, timeStr });
                });
                return bulkLookup;
            }

            function main(rtisData, selectedDirection) {
                try {
                    speedViolations = []; brakingExceptions = []; allLabels = []; allSpeedData = []; allMaxSpeedData = []; allTimestamps = []; allLocations = []; signalEvents = []; bulkMatchEvents = [];

                    magnifiedChartContainer.classList.add('hidden');
                    signalAnalysisContainer.classList.add('hidden');
                    bulkMatchContainer.classList.add('hidden');

                    let cautionSections = [];
                    const fullAnalysis = cautionData && cautionData.length > 0;
                    const signalAnalysis = signalData && signalData.length > 0;
                    const bulkAnalysis = bulkData && bulkData.length > 0;

                    let bulkLookup = new Map();

                    if (fullAnalysis) {
                        try {
                            cautionSections = processCautionData(cautionData);
                        } catch (e) {
                            showMessage("Caution Processing Error", e.message);
                        }
                    }

                    if (bulkAnalysis) {
                        try {
                            bulkLookup = processBulkData(bulkData);
                        } catch (e) {
                            showMessage("Bulk Data Error", e.message);
                        }
                    }

                    const latKey = findKey(rtisData[0], ['Latitude']);
                    const lonKey = findKey(rtisData[0], ['Longitude']);
                    const timeKey = findKey(rtisData[0], ['Logging Time']);
                    const gpsTimeKey = findKey(rtisData[0], ['Gps Time']);
                    const speedKey = findKey(rtisData[0], ['Speed']);
                    const stationKey = findKey(rtisData[0], ['last/cur stationCode', 'stationCode', 'Station Code', 'Station', 'STATION']);
                    // *** FIND RTIS DEVICE ID KEY ***
                    const deviceIdKey = findKey(rtisData[0], ['Device Id', 'DeviceId', 'Asset Id', 'DeviceID']);

                    if (!stationKey) throw new Error("Could not find a valid station code column in RTIS file for 'main' function.");

                    let currentViolation = null;
                    rtisData.forEach((row, index) => {
                        const lat = parseFloat(row[latKey]);
                        const lon = parseFloat(row[lonKey]);
                        let actualSpeed = parseFloat(row[speedKey]);
                        // Set speeds less than 0.8 km/h to 0 km/h
                        if (actualSpeed < 0.8) actualSpeed = 0;

                        const logTime = parseTimestamp(row[gpsTimeKey], row[timeKey]);

                        if (isNaN(lat) || isNaN(lon) || isNaN(actualSpeed) || isNaN(logTime.getTime())) return;

                        let maxSpeed = DEFAULT_MAX_SPEED;
                        let maxSpeedInfo = { speed: DEFAULT_MAX_SPEED, masts: null };

                        if (fullAnalysis) {
                            maxSpeedInfo = findMaxSpeedForPoint(lat, lon, cautionSections);
                            maxSpeed = maxSpeedInfo.speed;
                        }

                        const isViolating = fullAnalysis && actualSpeed > maxSpeed && maxSpeed < DEFAULT_MAX_SPEED;

                        if (isViolating) {
                            if (!currentViolation) {
                                currentViolation = {
                                    masts: maxSpeedInfo.masts ? `${maxSpeedInfo.masts.start} to ${maxSpeedInfo.masts.end}` : 'N/A',
                                    startTime: logTime, maxActualSpeed: actualSpeed, permittedSpeed: maxSpeed, points: [{ lat, lon }]
                                };
                            } else {
                                currentViolation.maxActualSpeed = Math.max(currentViolation.maxActualSpeed, actualSpeed);
                                currentViolation.points.push({ lat, lon });
                            }
                        } else if (currentViolation) {
                            finalizeViolation(currentViolation, logTime);
                            currentViolation = null;
                        }

                        const timeLabel = formatTime(logTime);
                        allLabels.push(timeLabel);
                        allTimestamps.push(logTime);
                        allSpeedData.push(actualSpeed);
                        allMaxSpeedData.push(maxSpeed);
                        // Calculate distance in metres from Speed (KMPH) using actual time difference
                        // distance = speed (KMPH) × time_diff (seconds) / 3.6
                        let distFromPrev = 0;
                        if (allLocations.length > 0) {
                            const prevTime = allLocations[allLocations.length - 1].time;
                            const timeDiffSeconds = (logTime - prevTime) / 1000; // Convert ms to seconds
                            if (timeDiffSeconds > 0 && timeDiffSeconds < 60) { // Reasonable time gap (< 60 seconds)
                                distFromPrev = actualSpeed * timeDiffSeconds / 3.6;
                            }
                        }
                        allLocations.push({ lat, lon, speed: actualSpeed, station: row[stationKey], time: logTime, point: turf.point([lon, lat]), distFromPrev: distFromPrev });

                        const stationCode = normalizeStationCode(row[stationKey]);

                        // Bulk Violation Matching
                        if (bulkAnalysis && deviceIdKey) {
                            const deviceId = String(row[deviceIdKey] || '').trim();
                            // We check if RTIS Time matches Signal Time (which is used to create the bulkKey)
                            const dateTimeKey = formatDateTime(logTime);
                            if (deviceId && dateTimeKey) {
                                const bulkKey = `${deviceId}_${stationCode}_${dateTimeKey}`;
                                if (bulkLookup.has(bulkKey)) {
                                    const matchData = bulkLookup.get(bulkKey);
                                    bulkMatchEvents.push({
                                        id: deviceId,
                                        station: stationCode,
                                        time: matchData.timeStr,
                                        rtisSpeed: actualSpeed,
                                        bulkSpeed: matchData.speed
                                    });
                                    bulkLookup.delete(bulkKey); // Avoid matched duplicates
                                }
                            }
                        }
                    });

                    if (currentViolation) finalizeViolation(currentViolation, allTimestamps[allTimestamps.length - 1]);
                    if (allLocations.length === 0) throw new Error("No valid data points found in the selected station range.");

                    if (signalAnalysis) {
                        signalEvents = processSignalData(signalData, allLocations, selectedDirection);
                        displaySignalEvents(signalEvents);
                    }

                    if (bulkAnalysis) displayBulkMatches(bulkMatchEvents);

                    plotFullChart(fullAnalysis);
                    plotFirst30MinutesChart(fullAnalysis);
                    plotBrakeFeel600Chart();
                    plotBrakePowerChart();
                    plotStoppingAnalysisChart();
                    plotHomeSignalsChart();
                    displayViolations(fullAnalysis);

                    loadingContainer.classList.add('hidden');
                    outputSections.classList.remove('hidden');

                } catch (error) {
                    loadingContainer.classList.add('hidden');
                    showMessage("Processing Error", error.message);
                    console.error(error);
                }
            }

            function finalizeViolation(violation, endTime) {
                const duration = (endTime.getTime() - violation.startTime.getTime()) / 1000;
                let distance = 0;
                if (violation.points.length > 1) {
                    for (let i = 0; i < violation.points.length - 1; i++) {
                        distance += turf.distance(turf.point([violation.points[i].lon, violation.points[i].lat]), turf.point([violation.points[i + 1].lon, violation.points[i + 1].lat]), { units: 'meters' });
                    }
                }
                speedViolations.push({ ...violation, duration: Math.max(1, duration), distance, breachTime: formatTime(violation.startTime) });
            }

            function processCautionData(cautionData) {
                // Caution data processing requires latitude/longitude coordinates
                // If caution data has its own coordinates, use them directly
                const startLatKey = findKey(cautionData[0], ['Start Latitude', 'From Latitude', 'Latitude From']);
                const startLonKey = findKey(cautionData[0], ['Start Longitude', 'From Longitude', 'Longitude From']);
                const endLatKey = findKey(cautionData[0], ['End Latitude', 'To Latitude', 'Latitude To']);
                const endLonKey = findKey(cautionData[0], ['End Longitude', 'To Longitude', 'Longitude To']);
                const startKey = findKey(cautionData[0], ['OHE mast from', 'From', 'Start']);
                const endKey = findKey(cautionData[0], ['OHE mast to', 'To', 'End']);
                const speedKey = findKey(cautionData[0], ['Speed Limit', 'Speed', 'Limit']);
                
                if (!speedKey) throw new Error("Caution file is missing Speed Limit column.");
                
                // If caution file has direct coordinates
                if (startLatKey && startLonKey && endLatKey && endLonKey) {
                    return cautionData.map(row => {
                        const startLat = parseFloat(row[startLatKey]);
                        const startLon = parseFloat(row[startLonKey]);
                        const endLat = parseFloat(row[endLatKey]);
                        const endLon = parseFloat(row[endLonKey]);
                        
                        if (!isNaN(startLat) && !isNaN(startLon) && !isNaN(endLat) && !isNaN(endLon)) {
                            return {
                                masts: { start: row[startKey] || 'Start', end: row[endKey] || 'End' },
                                line: turf.lineString([[startLon, startLat], [endLon, endLat]]),
                                speed: row[speedKey]
                            };
                        }
                        return null;
                    }).filter(Boolean);
                }
                
                // Without coordinates, caution processing cannot work
                console.warn('Caution file does not have coordinate columns. Caution sections will not be applied.');
                return [];
            }

            function findMaxSpeedForPoint(lat, lon, cautionSections) {
                const point = turf.point([lon, lat]);
                let minSpeed = DEFAULT_MAX_SPEED;
                let affectingMasts = null;
                for (const section of cautionSections) {
                    if (turf.pointToLineDistance(point, section.line, { units: 'meters' }) < COLOCATED_TOLERANCE_METERS) {
                        if (section.speed < minSpeed) {
                            minSpeed = section.speed;
                            affectingMasts = section.masts;
                        }
                    }
                }
                return { speed: minSpeed, masts: affectingMasts };
            }

            function processSignalData(signalData, rtisLocations, selectedDirection) {
                const events = [];
                const loggedSignalKeys = new Set();
                if (!signalData || signalData.length === 0 || !rtisLocations || rtisLocations.length === 0) return events;

                const latKey = findKey(signalData[0], ['Latitude']);
                const lonKey = findKey(signalData[0], ['Longitude']);
                const stationKey = findKey(signalData[0], ['Station', 'Location']);
                const typeKey = findKey(signalData[0], ['Type']);
                const stopSigKey = findKey(signalData[0], ['Designation Of Stop Signal']);
                const permSigKey = findKey(signalData[0], ['Designation Of Permissive Signal']);
                const applicableKey = findKey(signalData[0], ['Applicable For', 'Direction', 'Applicable']);

                if (!latKey || !lonKey || !stationKey) {
                    showMessage("Signal File Error", "Signal file is missing required columns.");
                    return events;
                }

                // Filter signals by direction and route SectionId
                const filteredSignals = signalData.filter(signal => {
                    // First check route SectionId filter
                    if (!isSignalInSelectedRoute(signal)) {
                        return false;
                    }
                    
                    // Then check direction filter
                    if (!applicableKey || !selectedDirection) return true;
                    const applicableFor = (signal[applicableKey] || '').toUpperCase();
                    const dir = selectedDirection.toUpperCase();
                    // Include if matches direction or if applicable field is empty/both
                    return !applicableFor || applicableFor.includes(dir) || applicableFor.includes('BOTH');
                });

                // Pre-compute signal points with their data
                const signalsWithPoints = filteredSignals.map(signal => {
                    const signalLat = parseFloat(signal[latKey]);
                    const signalLon = parseFloat(signal[lonKey]);
                    if (isNaN(signalLat) || isNaN(signalLon)) return null;
                    return { point: turf.point([signalLon, signalLat]), data: signal };
                }).filter(Boolean);

                if (signalsWithPoints.length === 0) return events;

                // Track stations where Starter has been encountered
                const stationsWithStarter = new Set();

                // Forward iteration through RTIS points to maintain signal sequence
                for (const rtisPoint of rtisLocations) {
                    // Find the nearest signal to this RTIS point
                    let nearestSignal = null;
                    let minDistance = Infinity;

                    for (const signal of signalsWithPoints) {
                        const distance = turf.distance(rtisPoint.point, signal.point, { units: 'meters' });
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestSignal = signal.data;
                        }
                    }

                    // Only record if within threshold and not already logged
                    if (minDistance < MAX_SIGNAL_DISTANCE_METERS && nearestSignal) {
                        const signalType = nearestSignal[typeKey] || nearestSignal[stopSigKey] || nearestSignal[permSigKey] || 'N/A';
                        const stationName = nearestSignal[stationKey] || 'N/A';
                        const signalKey = stationName + "_" + signalType;
                        const signalTypeLower = signalType.toLowerCase();

                        // Check if this is a Starter signal - mark station
                        if (signalTypeLower.includes('starter')) {
                            stationsWithStarter.add(stationName);
                        }

                        // Skip Distant/Home/Inner Distant signals if Starter for same station already logged
                        // (These would be wrong direction signals)
                        if (stationsWithStarter.has(stationName) && 
                            (signalTypeLower.includes('distant') || signalTypeLower.includes('home'))) {
                            continue;
                        }

                        if (!loggedSignalKeys.has(signalKey)) {
                            events.push({ station: stationName, type: signalType, time: formatTime(rtisPoint.time), speed: rtisPoint.speed });
                            loggedSignalKeys.add(signalKey);
                        }
                    }
                }
                return events;
            }

            function displaySignalEvents(signalEvents) {
                signalTableBody.innerHTML = '';
                if (signalEvents.length === 0) {
                    signalAnalysisContainer.classList.add('hidden');
                    return;
                }
                signalAnalysisContainer.classList.remove('hidden');
                signalEvents.forEach(ev => {
                    const row = signalTableBody.insertRow();
                    row.className = 'bg-white border-b';
                    const speedValue = isNaN(ev.speed) ? '0.0' : parseFloat(ev.speed).toFixed(1);
                    row.innerHTML = `<td class="py-1 px-3">${ev.station}</td><td class="py-1 px-3">${ev.type}</td><td class="py-1 px-3">${ev.time}</td><td class="py-1 px-3">${speedValue}</td>`;
                });
            }

            function displayBulkMatches(matches) {
                bulkMatchTableBody.innerHTML = '';
                if (matches.length === 0) {
                    bulkMatchContainer.classList.add('hidden');
                    if (bulkData && bulkData.length > 0) showMessage("Bulk Match Info", "No matches found between the Bulk Report and the RTIS data (checked DeviceID + Station + Signal Time).");
                    return;
                }
                bulkMatchContainer.classList.remove('hidden');
                matches.forEach(m => {
                    const row = bulkMatchTableBody.insertRow();
                    row.className = 'bg-white border-b';
                    row.innerHTML = `
                    <td class="py-1 px-3 font-medium text-gray-900">${m.id}</td>
                    <td class="py-1 px-3">${m.station}</td>
                    <td class="py-1 px-3">${m.time}</td>
                    <td class="py-1 px-3 font-bold text-blue-600">${m.rtisSpeed.toFixed(1)}</td>
                    <td class="py-1 px-3 text-red-600 font-bold">${m.bulkSpeed}</td>
                `;
                });
            }

            function plotChart(chartId, data, options, plugins = []) {
                const chartCanvas = document.getElementById(chartId);
                if (!chartCanvas) return;
                const existingChart = Chart.getChart(chartCanvas);
                if (existingChart) existingChart.destroy();
                const chartConfig = { type: 'line', data, options };
                if (plugins && plugins.length > 0) {
                    chartConfig.plugins = plugins;
                }
                return new Chart(chartCanvas.getContext('2d'), chartConfig);
            }

            function getChartOptions(titleText, xLabel, yLabel, enableZoom = false) {
                const options = {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        title: { display: !!titleText, text: titleText, font: { size: 16 } },
                        legend: { display: false }
                    },
                    scales: {
                        x: { title: { display: true, text: xLabel }, reverse: false, type: 'linear', ticks: { stepSize: 100 } },
                        y: { title: { display: true, text: yLabel }, beginAtZero: true, suggestedMax: 140 }
                    }
                };

                if (enableZoom) {
                    options.plugins.zoom = {
                        zoom: {
                            wheel: {
                                enabled: true,
                                speed: 0.1
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'xy'
                        },
                        pan: {
                            enabled: true,
                            mode: 'xy'
                        }
                    };
                }

                return options;
            }

            function plotFullChart(fullAnalysis) {
                const datasets = [
                    { label: 'Train Speed (KMPH)', data: allSpeedData, borderColor: '#de276d', tension: 0.1, pointRadius: 0, borderWidth: 2 }
                ];

                if (fullAnalysis) {
                    datasets.push(
                        { label: 'Permissible Speed (KMPH)', data: allMaxSpeedData, borderColor: '#dc2626', stepped: true, pointRadius: 0, borderWidth: 2 }
                    );
                }

                const data = { labels: allLabels, datasets };
                const options = getChartOptions(null, 'Time', 'Speed (KMPH)', true);
                options.plugins.legend.display = fullAnalysis;
                options.scales.x.type = 'category';
                speedChart = plotChart('speedChart', data, options);
            }

            function plotFirst30MinutesChart(fullAnalysis) {
                const thirtyMinIndex = allTimestamps.findIndex(t => t.getTime() > allTimestamps[0].getTime() + 30 * 60 * 1000);
                const endIndex = thirtyMinIndex > -1 ? thirtyMinIndex : allLabels.length;

                const datasets = [
                    { label: 'Train Speed (KMPH)', data: allSpeedData.slice(0, endIndex), borderColor: '#93078b', tension: 0.1, pointRadius: 0, borderWidth: 2 }
                ];

                if (fullAnalysis) {
                    datasets.push(
                        { label: 'Permissible Speed (KMPH)', data: allMaxSpeedData.slice(0, endIndex), borderColor: '#dc2626', stepped: true, pointRadius: 0, borderWidth: 2 }
                    );
                }

                const data = {
                    labels: allLabels.slice(0, endIndex),
                    datasets
                };
                const options = getChartOptions(null, 'Time', 'Speed (KMPH)', true);
                options.plugins.legend.display = fullAnalysis;
                options.scales.x.type = 'category';
                first30MinChart = plotChart('first30MinChart', data, options);
            }

            function createAdditionalBrakeGraph() {
                if (!brakeChartDataCache) {
                    showMessage("Error", "No brake pattern data available. Please run analysis first.");
                    return;
                }

                brakeGraphCounter++;
                const graphId = `brake-graph-${brakeGraphCounter}`;
                const canvasId = `brakeChart-${brakeGraphCounter}`;
                const legendId = `brake-legend-${brakeGraphCounter}`;
                const toggleBtnId = `toggle-all-brake-${brakeGraphCounter}`;
                const removeBtnId = `remove-brake-${brakeGraphCounter}`;

                // Create the graph container HTML
                const graphHTML = `
                    <div class="page-break"></div>
                    <div id="${graphId}" class="mb-8 border-2 border-gray-300 rounded-lg p-4" style="min-height: 600px;">
                        <div class="flex justify-between items-center mb-2 md:mb-4 gap-2">
                            <button id="${toggleBtnId}" class="toggle-all-legends no-print" title="Toggle all legends">Toggle All</button>
                            <button id="${removeBtnId}" class="no-print px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-red-700 transition-colors" title="Remove this graph">🗑️ Remove</button>
                        </div>
                        <div id="${legendId}"
                            class="text-center text-xs md:text-sm text-black-600 mb-4 p-2 flex flex-wrap justify-center gap-2">
                        </div>
                        <div class="relative mb-8" style="height: 500px;">
                            <canvas id="${canvasId}" class="chart-a4"></canvas>
                        </div>
                    </div>
                `;

                // Insert the graph into the container
                const container = document.getElementById('additional-brake-graphs-container');
                container.insertAdjacentHTML('beforeend', graphHTML);

                // Clone the datasets from cache
                const datasets = JSON.parse(JSON.stringify(brakeChartDataCache.datasets));
                const options = JSON.parse(JSON.stringify(brakeChartDataCache.options));
                
                // Create the chart
                const newChart = plotChart(canvasId, { datasets }, options, brakeChartDataCache.plugins);
                
                // Store chart instance
                additionalBrakeCharts.push({
                    id: graphId,
                    chartInstance: newChart,
                    canvasId: canvasId,
                    legendId: legendId
                });

                // Setup legend interactivity
                const legendContainer = document.getElementById(legendId);
                
                // Populate legend
                datasets.forEach((dataset, index) => {
                    if (!dataset.isSignalDataset && !dataset.isCommonStarterSignal) {
                        const color = dataset.borderColor;
                        let legendLabel = '';
                        let signalText = '';
                        
                        if (dataset.signalInfo) {
                            signalText = `${dataset.signalInfo.station} (${dataset.signalInfo.type}) ${Math.round(dataset.signalInfo.distance)}m`;
                        }

                        const legendEl = document.createElement('span');
                        legendEl.className = 'legend-item inline-flex flex-col items-start m-1 px-2 py-0.5 rounded-full text-xs font-medium';
                        legendEl.style.backgroundColor = `${color}20`;
                        legendEl.style.color = color;
                        legendEl.innerHTML = `<div class="legend-item-content"><div class="legend-item-text">${signalText}<br>${dataset.timeLabel || ''}</div><span class="legend-item-delete" title="Click to delete this dataset">✕</span></div>`;
                        legendEl.dataset.datasetIndex = index;
                        legendEl.title = `${signalText} - ${dataset.timeLabel || ''}`;
                        legendContainer.appendChild(legendEl);

                        // Handle click to toggle visibility
                        legendEl.addEventListener('click', (e) => {
                            if (e.target.classList.contains('legend-item-delete')) {
                                e.stopPropagation();
                                return;
                            }

                            const clickedIndex = parseInt(legendEl.dataset.datasetIndex);
                            const clickedDataset = newChart.data.datasets[clickedIndex];

                            clickedDataset.hidden = !clickedDataset.hidden;
                            legendEl.classList.toggle('striked', clickedDataset.hidden);

                            const stopIndex = clickedDataset.stopIndex;
                            newChart.data.datasets.forEach((ds, idx) => {
                                if (ds.isSignalDataset && ds.stopIndex === stopIndex) {
                                    ds.hidden = clickedDataset.hidden;
                                }
                            });

                            const allLegends = legendContainer.querySelectorAll('.legend-item');
                            const allHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));
                            const toggleBtn = document.getElementById(toggleBtnId);
                            if (toggleBtn) {
                                toggleBtn.classList.toggle('active', allHidden && allLegends.length > 0);
                            }

                            newChart.update();
                        });

                        // Handle delete button
                        const deleteBtn = legendEl.querySelector('.legend-item-delete');
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                
                                const datasetIndex = parseInt(legendEl.dataset.datasetIndex);
                                const stopIndex = newChart.data.datasets[datasetIndex].stopIndex;

                                newChart.data.datasets.splice(datasetIndex, 1);

                                for (let i = newChart.data.datasets.length - 1; i >= 0; i--) {
                                    const ds = newChart.data.datasets[i];
                                    if (ds.isSignalDataset && ds.stopIndex === stopIndex) {
                                        newChart.data.datasets.splice(i, 1);
                                    }
                                }

                                legendEl.remove();

                                legendContainer.querySelectorAll('.legend-item').forEach((legendItem, idx) => {
                                    let correctIndex = 0;
                                    for (let i = 0; i < newChart.data.datasets.length; i++) {
                                        if (!newChart.data.datasets[i].isSignalDataset && !newChart.data.datasets[i].isCommonStarterSignal) {
                                            if (correctIndex === idx) {
                                                legendItem.dataset.datasetIndex = i;
                                                break;
                                            }
                                            correctIndex++;
                                        }
                                    }
                                });

                                const allLegends = legendContainer.querySelectorAll('.legend-item');
                                const allHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));
                                const toggleBtn = document.getElementById(toggleBtnId);
                                if (toggleBtn) {
                                    toggleBtn.classList.toggle('active', allHidden && allLegends.length > 0);
                                }

                                newChart.update();
                            });
                        }
                    }
                });

                // Setup toggle all button
                const toggleAllBtn = document.getElementById(toggleBtnId);
                if (toggleAllBtn) {
                    toggleAllBtn.addEventListener('click', () => {
                        const overlay = document.getElementById('page-loading-overlay');
                        if (overlay) overlay.classList.add('active');

                        setTimeout(() => {
                            const allLegends = legendContainer.querySelectorAll('.legend-item');
                            const isCurrentlyAllHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));

                            allLegends.forEach((legendItem, legendIndex) => {
                                // Find the corresponding dataset by position (accounting for signal datasets)
                                let datasetCount = 0;
                                let dataset = null;
                                
                                for (let i = 0; i < newChart.data.datasets.length; i++) {
                                    if (!newChart.data.datasets[i].isSignalDataset && !newChart.data.datasets[i].isCommonStarterSignal) {
                                        if (datasetCount === legendIndex) {
                                            dataset = newChart.data.datasets[i];
                                            break;
                                        }
                                        datasetCount++;
                                    }
                                }

                                if (!dataset) return;

                                if (isCurrentlyAllHidden) {
                                    dataset.hidden = false;
                                    legendItem.classList.remove('striked');
                                } else {
                                    dataset.hidden = true;
                                    legendItem.classList.add('striked');
                                }

                                const stopIndex = dataset.stopIndex;
                                newChart.data.datasets.forEach((ds, idx) => {
                                    if (ds.isSignalDataset && ds.stopIndex === stopIndex) {
                                        ds.hidden = dataset.hidden;
                                    }
                                });
                            });

                            const allNowHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));
                            toggleAllBtn.classList.toggle('active', allNowHidden && allLegends.length > 0);

                            newChart.update();

                            if (overlay) overlay.classList.remove('active');
                        }, 50);
                    });
                }

                // Setup remove button
                const removeBtn = document.getElementById(removeBtnId);
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        if (confirm('Are you sure you want to remove this graph?')) {
                            // Destroy chart instance
                            if (newChart) {
                                newChart.destroy();
                            }
                            
                            // Remove from array
                            const index = additionalBrakeCharts.findIndex(c => c.id === graphId);
                            if (index > -1) {
                                additionalBrakeCharts.splice(index, 1);
                            }
                            
                            // Remove DOM element
                            const graphElement = document.getElementById(graphId);
                            if (graphElement) {
                                graphElement.remove();
                            }
                        }
                    });
                }

                // Scroll to the new graph
                setTimeout(() => {
                    const newGraph = document.getElementById(graphId);
                    if (newGraph) {
                        newGraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }

            function plotBrakeFeel600Chart() {
                // Calculate cumulative distance from start
                let cumulativeDistance = 0;
                let allDistances = [];
                let allSpeeds = [];
                
                // Build distance and speed arrays for first 600 meters
                for (let i = 0; i < allLocations.length; i++) {
                    if (cumulativeDistance > 1300) break;
                    
                    const distance = allLocations[i].distFromPrev || 0;
                    cumulativeDistance += distance;
                    allDistances.push(cumulativeDistance);
                    allSpeeds.push(allSpeedData[i] || 0);
                }

                // Find start point: first time speed > 1 KMPH
                let startIdx = -1;
                
                for (let i = 0; i < allSpeeds.length; i++) {
                    if (allSpeeds[i] > 1) {
                        startIdx = i;
                        break;
                    }
                }
                
                if (startIdx === -1) startIdx = 0;
                
                // Trim arrays to start from the identified point and limit to 600m from that point
                const distances = [];
                const speeds = [];
                const distanceLabels = [];
                const startDistance = allDistances[startIdx];
                let graphCumulativeDistance = 0;
                
                for (let i = startIdx; i < allDistances.length; i++) {
                    const relativeDistance = allDistances[i] - startDistance;
                    
                    if (relativeDistance > 1300) break;
                    
                    distances.push(relativeDistance);
                    speeds.push(allSpeeds[i]);
                    distanceLabels.push(Math.round(relativeDistance));
                    graphCumulativeDistance = relativeDistance;
                }

                // Analyze brake feel test
                const analysisInfo = {
                    initialSpeed: 0,
                    finalSpeed: 0,
                    speedReduction: 0,
                    maxSpeed: 0,
                    maxSpeedDistance: 0,
                    brakesEffective: false,
                    totalDistance: graphCumulativeDistance
                };

                if (speeds.length > 0) {
                    // Find max speed (should be between 10-15 KMPH for test to start properly)
                    let maxSpeedIdx = 0;
                    let maxSpeed = 0;
                    for (let i = 0; i < speeds.length; i++) {
                        if (speeds[i] > maxSpeed) {
                            maxSpeed = speeds[i];
                            maxSpeedIdx = i;
                        }
                    }
                    
                    analysisInfo.maxSpeed = maxSpeed;
                    analysisInfo.maxSpeedDistance = distances[maxSpeedIdx];
                    analysisInfo.initialSpeed = maxSpeed;
                    
                    // Find final speed (last speed in the dataset)
                    analysisInfo.finalSpeed = speeds[speeds.length - 1];
                    
                    // Calculate speed reduction percentage (from max to final)
                    if (maxSpeed > 0) {
                        analysisInfo.speedReduction = ((maxSpeed - analysisInfo.finalSpeed) / maxSpeed) * 100;
                    }
                    
                    // Check if brakes are effective (at least 30% speed reduction)
                    analysisInfo.brakesEffective = analysisInfo.speedReduction >= 30;
                }

                // Update analysis info display
                const analysisDiv = document.getElementById('brakeFeel-analysis-info');
                document.getElementById('brakeFeel-initial-speed').textContent = analysisInfo.initialSpeed.toFixed(2) + ' KMPH';
                document.getElementById('brakeFeel-final-speed').textContent = analysisInfo.finalSpeed.toFixed(2) + ' KMPH';
                document.getElementById('brakeFeel-speed-reduction').textContent = analysisInfo.speedReduction.toFixed(1) + '%';
                document.getElementById('brakeFeel-distance').textContent = analysisInfo.totalDistance.toFixed(0) + ' m';
                
                const effectiveCell = document.getElementById('brakeFeel-effective');
                if (analysisInfo.brakesEffective) {
                    effectiveCell.innerHTML = '<span class="font-bold text-green-700">✓ YES (≥30%)</span>';
                } else {
                    effectiveCell.innerHTML = '<span class="font-bold text-red-700">✗ NO (<30%)</span>';
                }

                // Create chart data
                const datasets = [
                    { 
                        label: 'Train Speed (KMPH)', 
                        data: speeds, 
                        borderColor: '#2563eb', 
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        tension: 0.3, 
                        pointRadius: 1,
                        pointBackgroundColor: '#2563eb',
                        borderWidth: 1,
                        fill: false
                    }
                ];

                // Add reference zones
                if (analysisInfo.initialSpeed > 0) {
                    // Add line showing initial speed (for reference)
                    // datasets.push({
                    //     label: 'Initial Speed',
                    //     data: Array(speeds.length).fill(analysisInfo.initialSpeed),
                    //     borderColor: '#f59e0b',
                    //     borderDash: [5, 5],
                    //     pointRadius: 0,
                    //     borderWidth: 1,
                    //     fill: false
                    // });
                }

                const data = {
                    labels: distanceLabels,
                    datasets
                };

                const options = getChartOptions(null, 'Distance (Metres)', 'Speed (KMPH)');
                options.plugins.legend.display = false;
                options.plugins.datalabels = {
                    display: true,
                    color: '#1f2937',
                    font: { size: 10, weight: 'bold' },
                    anchor: 'top',
                    offset: 6,
                    formatter: function(value, context) {
                        if (value === null || value === undefined) return '';
                        // Show label only at key points: start (index 0), end, and every 20% of data
                        const dataLength = context.dataset.data.length;
                        const index = context.dataIndex;
                        const shouldShow = index === 0 || index === dataLength - 1 || index % Math.ceil(dataLength / 5) === 0;
                        return shouldShow ? value.toFixed(1) : '';
                    }
                };
                options.scales.x.type = 'category';
                options.scales.y.beginAtZero = true;
                options.scales.y.max = 20;
                
                brakeFeel600Chart = plotChart('brakeFeel600Chart', data, options);
            }

            function plotBrakePowerChart() {
                // Calculate cumulative distance from start
                let cumulativeDistance = 0;
                let allDistances = [];
                let allSpeeds = [];
                
                // Build distance and speed arrays for first 10 KMs (10000 meters)
                for (let i = 0; i < allLocations.length; i++) {
                    if (cumulativeDistance > 10500) break;
                    
                    const distance = allLocations[i].distFromPrev || 0;
                    cumulativeDistance += distance;
                    allDistances.push(cumulativeDistance);
                    allSpeeds.push(allSpeedData[i] || 0);
                }

                // Find start point: first time speed reaches 60-70 KMPH range
                let startIdx = -1;
                
                for (let i = 0; i < allSpeeds.length; i++) {
                    if (allSpeeds[i] >= 60) {
                        startIdx = i;
                        break;
                    }
                }
                
                if (startIdx === -1) startIdx = 0;
                
                // Trim arrays to start from the identified point and limit to 10 KMs from that point
                const distances = [];
                const speeds = [];
                const distanceLabels = [];
                const startDistance = allDistances[startIdx];
                let graphCumulativeDistance = 0;
                
                for (let i = startIdx; i < allDistances.length; i++) {
                    const relativeDistance = allDistances[i] - startDistance;
                    
                    if (relativeDistance > 10000) break;
                    
                    distances.push(relativeDistance);
                    speeds.push(allSpeeds[i]);
                    distanceLabels.push(Math.round(relativeDistance));
                    graphCumulativeDistance = relativeDistance;
                }

                // Analyze brake power test
                const analysisInfo = {
                    initialSpeed: 0,
                    finalSpeed: 0,
                    speedReduction: 0,
                    maxSpeed: 0,
                    maxSpeedDistance: 0,
                    brakesEffective: false,
                    totalDistance: graphCumulativeDistance
                };

                if (speeds.length > 0) {
                    // Find max speed in this window (should be 60-70 KMPH for brake power test)
                    let maxSpeedIdx = 0;
                    let maxSpeed = 0;
                    for (let i = 0; i < speeds.length; i++) {
                        if (speeds[i] > maxSpeed) {
                            maxSpeed = speeds[i];
                            maxSpeedIdx = i;
                        }
                    }
                    
                    analysisInfo.maxSpeed = maxSpeed;
                    analysisInfo.maxSpeedDistance = distances[maxSpeedIdx];
                    analysisInfo.initialSpeed = maxSpeed;
                    
                    // Find final speed (last speed in the dataset)
                    analysisInfo.finalSpeed = speeds[speeds.length - 1];
                    
                    // Calculate speed reduction percentage (from max to final)
                    if (maxSpeed > 0) {
                        analysisInfo.speedReduction = ((maxSpeed - analysisInfo.finalSpeed) / maxSpeed) * 100;
                    }
                    
                    // Check if brakes are effective (at least 50% speed reduction for brake power test)
                    // Since we're going from 60-70 to 30-35, we need good braking performance
                    analysisInfo.brakesEffective = analysisInfo.speedReduction >= 50 && analysisInfo.finalSpeed <= 35;
                }

                // Update analysis info display
                const analysisDiv = document.getElementById('brakePower-analysis-info');
                document.getElementById('brakePower-initial-speed').textContent = analysisInfo.initialSpeed.toFixed(2) + ' KMPH';
                document.getElementById('brakePower-final-speed').textContent = analysisInfo.finalSpeed.toFixed(2) + ' KMPH';
                document.getElementById('brakePower-speed-reduction').textContent = analysisInfo.speedReduction.toFixed(1) + '%';
                document.getElementById('brakePower-distance').textContent = analysisInfo.totalDistance.toFixed(0) + ' m';
                
                const effectiveCell = document.getElementById('brakePower-effective');
                if (analysisInfo.brakesEffective) {
                    effectiveCell.innerHTML = '<span class="font-bold text-green-700">✓ YES (≥50% & ≤35 KMPH)</span>';
                } else {
                    effectiveCell.innerHTML = '<span class="font-bold text-red-700">✗ NO (<50% or >35 KMPH)</span>';
                }

                // Create chart data
                const datasets = [
                    { 
                        label: 'Train Speed (KMPH)', 
                        data: speeds, 
                        borderColor: '#059669', 
                        backgroundColor: 'rgba(5, 150, 105, 0.1)',
                        tension: 0.3, 
                        pointRadius: 1,
                        pointBackgroundColor: '#059669',
                        borderWidth: 1,
                        fill: false
                    }
                ];

                // Add reference zones
                if (analysisInfo.initialSpeed > 0) {
                    // Add line showing initial speed (for reference)
                    datasets.push({
                        label: 'Initial Speed',
                        data: Array(speeds.length).fill(analysisInfo.initialSpeed),
                        borderColor: '#f59e0b',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        borderWidth: 1,
                        fill: false
                    });
                    
                    // Add target speed line (30-35 KMPH range center)
                    // datasets.push({
                    //     label: 'Target Speed (32.5 KMPH)',
                    //     data: Array(speeds.length).fill(32.5),
                    //     borderColor: '#06b6d4',
                    //     borderDash: [5, 5],
                    //     pointRadius: 0,
                    //     borderWidth: 1,
                    //     fill: false
                    // });
                }

                const data = {
                    labels: distanceLabels,
                    datasets
                };

                const options = getChartOptions(null, 'Distance (Metres)', 'Speed (KMPH)');
                options.plugins.legend.display = false;
                options.plugins.datalabels = {
                    display: true,
                    color: '#1f2937',
                    font: { size: 10, weight: 'bold' },
                    anchor: 'top',
                    offset: 6,
                    formatter: function(value, context) {
                        if (value === null || value === undefined) return '';
                        // Show label only at key points: start (index 0), end, and every 20% of data
                        const dataLength = context.dataset.data.length;
                        const index = context.dataIndex;
                        const shouldShow = index === 0 || index === dataLength - 1 || index % Math.ceil(dataLength / 5) === 0;
                        return shouldShow ? value.toFixed(1) : '';
                    }
                };
                options.scales.x.type = 'category';
                options.scales.y.beginAtZero = true;
                options.scales.y.max = 130;
                
                brakePowerChart = plotChart('brakePowerChart', data, options);
            }

            function displayViolations(fullAnalysis) {
                violationsTableBody.innerHTML = '';
                if (speedViolations.length === 0 || !fullAnalysis) {
                    violationsContainer.classList.add('hidden');
                    return;
                }
                violationsContainer.classList.remove('hidden');
                speedViolations.forEach(v => {
                    const row = violationsTableBody.insertRow();
                    row.className = 'bg-white border-b hover:bg-gray-50 violation-row';
                    row.innerHTML = `<td class="py-1 px-3">${v.masts}</td><td class="py-1 px-3 text-red-600 font-bold">${v.maxActualSpeed.toFixed(1)}</td><td class="py-1 px-3">${v.permittedSpeed}</td><td class="py-1 px-3">${Math.round(v.duration)}</td><td class="py-1 px-3">${Math.round(v.distance)}</td><td class="py-1 px-3">${v.breachTime}</td>`;
                    row.onclick = () => plotViolationDetailChart(v);
                });
            }

            function displayBrakingExceptions() {
                brakingExceptionsTableBody.innerHTML = '';
                
                // Filter exceptions to only show those within 100 meters of stop signal
                const filteredExceptions = brakingExceptions.filter(ex => {
                    return ex.distanceToStop !== undefined && ex.distanceToStop <= 100;
                });
                
                if (filteredExceptions.length === 0) {
                    brakingExceptionsContainer.classList.add('hidden');
                    return;
                }
                brakingExceptionsContainer.classList.remove('hidden');
                filteredExceptions.forEach(ex => {
                    const row = brakingExceptionsTableBody.insertRow();
                    row.className = 'bg-white border-b';
                    const distanceDisplay = ex.distanceToStop !== undefined ? ex.distanceToStop.toFixed(1) : 'N/A';
                    row.innerHTML = `<td class="py-1 px-3">${ex.station}</td><td class="py-1 px-3">${ex.location}</td><td class="py-1 px-3 text-red-600 font-bold">${ex.actualSpeed.toFixed(1)}</td><td class="py-1 px-3">${ex.standardSpeed}</td><td class="py-1 px-3">${distanceDisplay}m</td><td class="py-1 px-3">${ex.time}</td>`;
                });
            }

            function plotViolationDetailChart(violation) {
                const start = violation.startTime.getTime() - DETAIL_TIME_WINDOW_MINUTES * 60 * 1000;
                const end = violation.startTime.getTime() + DETAIL_TIME_WINDOW_MINUTES * 60 * 1000;

                const relevantLabels = [];
                const relevantSpeedData = [];
                const relevantMaxSpeedData = [];

                for (let i = 0; i < allTimestamps.length; i++) {
                    if (allTimestamps[i].getTime() >= start && allTimestamps[i].getTime() <= end) {
                        relevantLabels.push(allLabels[i]);
                        relevantSpeedData.push(allSpeedData[i]);
                        relevantMaxSpeedData.push(allMaxSpeedData[i]);
                    }
                }

                const datasets = [
                    { label: 'Train Speed', data: relevantSpeedData, borderColor: '#2563eb', pointRadius: 1, borderWidth: 2 },
                    { label: 'Permitted Speed', data: relevantMaxSpeedData, borderColor: '#dc2626', stepped: true, pointRadius: 0, borderWidth: 2 }
                ];

                const data = {
                    labels: relevantLabels,
                    datasets: datasets
                };
                const options = getChartOptions(`Detail View: Breach at ${violation.breachTime}`, 'Time', 'Speed (KMPH)');
                options.plugins.legend.display = true;
                options.scales.x.type = 'category';
                magnifiedSpeedChart = plotChart('magnifiedSpeedChart', data, options);
                magnifiedChartContainer.classList.remove('hidden');
                magnifiedChartContainer.scrollIntoView({ behavior: 'smooth' });
            }

            document.addEventListener('click', function (e) {
                const target = e.target;
                if (target.classList.contains('add-row')) {
                    const row = target.closest('tr');
                    const newRow = row.cloneNode(true);

                    // Clear input/textarea values in new row
                    const inputs = newRow.querySelectorAll('input');
                    inputs.forEach(input => input.value = '');
                    // Set last input to NIL (Remarks column)
                    if (inputs.length > 0) {
                        inputs[inputs.length - 1].value = 'NIL';
                    }
                    
                    const textareas = newRow.querySelectorAll('textarea');
                    textareas.forEach(t => t.value = '');
                    // Set last textarea to NIL (Remarks column)
                    if (textareas.length > 0) {
                        textareas[textareas.length - 1].value = 'NIL';
                    }

                    row.parentNode.insertBefore(newRow, row.nextSibling);
                    return;
                }

                if (target.classList.contains('remove-row')) {
                    const row = target.closest('tr');
                    const tbody = row && row.parentNode;
                    if (tbody && tbody.rows && tbody.rows.length > 1) {
                        row.remove();
                    } else {
                        // If only one row remains, clear inputs instead of removing
                        const inputs = row.querySelectorAll('input');
                        inputs.forEach(input => input.value = '');
                        // Set last input to NIL (Remarks column)
                        if (inputs.length > 0) {
                            inputs[inputs.length - 1].value = 'NIL';
                        }
                        
                        const textareas = row.querySelectorAll('textarea');
                        textareas.forEach(t => t.value = '');
                        // Set last textarea to NIL (Remarks column)
                        if (textareas.length > 0) {
                            textareas[textareas.length - 1].value = 'NIL';
                        }
                    }
                }
            });

                // -- Column Resizing for Speed Analysis table --
                function enableColumnResizing() {
                    const tables = document.querySelectorAll('.speed-analysis-table');
                    tables.forEach(table => {
                        const ths = table.querySelectorAll('thead th');
                        ths.forEach((th, index) => {
                            // Ensure th is positioned so absolute resizer can be placed
                            th.style.position = th.style.position || 'relative';

                            const resizer = document.createElement('div');
                            resizer.className = 'col-resizer';
                            th.appendChild(resizer);

                            let startX = 0;
                            let startWidth = 0;

                            const onMouseMove = function (e) {
                                const dx = e.pageX - startX;
                                const newWidth = Math.max(40, startWidth + dx);
                                th.style.width = newWidth + 'px';
                                // apply width to all cells in this column
                                table.querySelectorAll('tbody tr').forEach(r => {
                                    const cell = r.children[index];
                                    if (cell) cell.style.width = newWidth + 'px';
                                });
                            };

                            const onMouseUp = function () {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                            };

                            resizer.addEventListener('mousedown', function (e) {
                                e.preventDefault();
                                startX = e.pageX;
                                startWidth = th.offsetWidth;
                                document.addEventListener('mousemove', onMouseMove);
                                document.addEventListener('mouseup', onMouseUp);
                            });

                            // touch support
                            const onTouchMove = function (e) {
                                const dx = e.touches[0].pageX - startX;
                                const newWidth = Math.max(40, startWidth + dx);
                                th.style.width = newWidth + 'px';
                                table.querySelectorAll('tbody tr').forEach(r => {
                                    const cell = r.children[index];
                                    if (cell) cell.style.width = newWidth + 'px';
                                });
                            };

                            const onTouchEnd = function () {
                                document.removeEventListener('touchmove', onTouchMove);
                                document.removeEventListener('touchend', onTouchEnd);
                            };

                            resizer.addEventListener('touchstart', function (e) {
                                e.preventDefault();
                                startX = e.touches[0].pageX;
                                startWidth = th.offsetWidth;
                                document.addEventListener('touchmove', onTouchMove);
                                document.addEventListener('touchend', onTouchEnd);
                            });
                        });
                    });
                }

                // Initialize resizers after DOM ready and later if tables are cloned/added
                enableColumnResizing();


            function findNextSignalAfterStop(stopPoint) {
                if (!signalData || signalData.length === 0) return null;

                const latKey = findKey(signalData[0], ['Latitude']);
                const lonKey = findKey(signalData[0], ['Longitude']);
                const stationKey = findKey(signalData[0], ['Station', 'Location']);
                const typeKey = findKey(signalData[0], ['Type']);
                const stopSigKey = findKey(signalData[0], ['Designation Of Stop Signal']);
                const permSigKey = findKey(signalData[0], ['Designation Of Permissive Signal']);

                if (!latKey || !lonKey) return null;

                let closestSignal = null;
                let minDistance = Infinity;

                for (const signal of signalData) {
                    // Filter signals by selected route SectionId
                    if (!isSignalInSelectedRoute(signal)) continue;
                    
                    const signalLat = parseFloat(signal[latKey]);
                    const signalLon = parseFloat(signal[lonKey]);
                    if (isNaN(signalLat) || isNaN(signalLon)) continue;

                    const signalPoint = turf.point([signalLon, signalLat]);
                    const distance = turf.distance(stopPoint, signalPoint, { units: 'meters' });

                    if (distance < minDistance && distance > 0) {
                        minDistance = distance;
                        closestSignal = {
                            type: signal[typeKey] || signal[stopSigKey] || signal[permSigKey] || 'Unknown',
                            station: signal[stationKey] || 'N/A',
                            distance: minDistance
                        };
                    }
                }

                return closestSignal && minDistance < 5000 ? closestSignal : null;
            }

            function plotStoppingAnalysisChart() {
                const STOP_SPEED_THRESHOLD = 2;
                const MIN_STOP_DURATION_SECONDS = 10;
                let stops = [];
                let potentialStopStartIdx = -1;
                let potentialStopEndIdx = -1;

                allLocations.forEach((loc, i) => {
                    if (isNaN(loc.time.getTime())) return;
                    const isStopped = loc.speed < STOP_SPEED_THRESHOLD;
                    if (isStopped && potentialStopStartIdx === -1) {
                        potentialStopStartIdx = i;
                        potentialStopEndIdx = i;
                    } else if (isStopped && potentialStopStartIdx !== -1) {
                        // Keep updating the end index to the last stopped point
                        potentialStopEndIdx = i;
                    } else if (!isStopped && potentialStopStartIdx !== -1) {
                        const duration = (allLocations[potentialStopEndIdx].time.getTime() - allLocations[potentialStopStartIdx].time.getTime()) / 1000;
                        if (duration >= MIN_STOP_DURATION_SECONDS) {
                            // Use potentialStopEndIdx which is the last point BEFORE train restarted
                            stops.push({ endIndex: potentialStopEndIdx, station: allLocations[potentialStopEndIdx].station || 'N/A', time: allLocations[potentialStopEndIdx].time });
                        }
                        potentialStopStartIdx = -1;
                        potentialStopEndIdx = -1;
                    }
                });

                if (potentialStopStartIdx !== -1) {
                    const lastIndex = allLocations.length - 1;
                    if (!isNaN(allLocations[lastIndex].time.getTime())) {
                        // Update potentialStopEndIdx to last index if still in stopped state
                        if (potentialStopEndIdx === -1 || allLocations[lastIndex].speed < STOP_SPEED_THRESHOLD) {
                            potentialStopEndIdx = lastIndex;
                        }
                        const duration = (allLocations[potentialStopEndIdx].time.getTime() - allLocations[potentialStopStartIdx].time.getTime()) / 1000;
                        if (duration >= MIN_STOP_DURATION_SECONDS) {
                            stops.push({ endIndex: potentialStopEndIdx, station: allLocations[potentialStopEndIdx].station || 'N/A', time: allLocations[potentialStopEndIdx].time });
                        }
                    }
                }

                stoppageLegend.innerHTML = '';
                brakingExceptions = [];
                stoppingAnalysisStops = stops; // Store stops globally for table population
                if (stops.length === 0) {
                    stoppageLegend.innerHTML = 'No significant stops detected.';
                    if (stoppingAnalysisChart) stoppingAnalysisChart.destroy();
                    brakingExceptionsContainer.classList.add('hidden');
                    return;
                }

                const brakingCheckpoints = [
                    { name: 'Home Signal (1000m before stopping)', distance: 1000, speed: 60 },
                    { name: 'Platform Entering (600m before stopping)', distance: 600, speed: 40 },
                    { name: 'Sigma Board (100m before stopping)', distance: 100, speed: 10 }
                ];

                const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#1a9850', '#d6604d', '#4575b4', '#181515'];
                const datasets = [];
                
                // Group stops by their nearest signal to ensure consistent reference point
                const stopGroups = new Map(); // Map signal key -> {signal info, stops array}
                
                stops.forEach((stop, index) => {
                    const stopPoint = turf.point([allLocations[stop.endIndex].lon, allLocations[stop.endIndex].lat]);
                    const nextSignal = findNextSignalAfterStop(stopPoint);
                    
                    if (nextSignal) {
                        // Create a unique key for this signal (station + type)
                        const signalKey = `${nextSignal.station}_${nextSignal.type}`;
                        
                        if (!stopGroups.has(signalKey)) {
                            stopGroups.set(signalKey, {
                                signal: nextSignal,
                                stops: []
                            });
                        }
                        
                        stopGroups.get(signalKey).stops.push({...stop, originalIndex: index, stopPoint});
                    } else {
                        // No signal found, treat as standalone
                        const signalKey = `no_signal_${index}`;
                        stopGroups.set(signalKey, {
                            signal: null,
                            stops: [{...stop, originalIndex: index, stopPoint}]
                        });
                    }
                });
                
                // Now process each group - all stops in a group will share the same reference signal and distance
                stopGroups.forEach((group, signalKey) => {
                    // Use the first stop's signal info as the reference for all stops in this group
                    const referenceSignal = group.signal;
                    const referenceDistanceToNextSignal = referenceSignal ? referenceSignal.distance : 0;
                    
                    group.stops.forEach(stop => {
                        const index = stop.originalIndex;
                        const stopPoint = stop.stopPoint;
                        const stopData = [];
                        let checkedPoints = new Set();

                        // Calculate cumulative distance for braking curve
                        let cumulativeDistance = 0;
                        const distanceMap = []; // Maps index to cumulative distance
                        
                        // First pass: calculate cumulative distances backwards from stop
                        for (let i = stop.endIndex - 1; i >= 0; i--) {
                            const currentLoc = allLocations[i];
                            // Add distance from current point to next point (towards stop) FIRST
                            if (i < stop.endIndex - 1 && allLocations[i + 1]) {
                                const nextDist = allLocations[i + 1].distFromPrev || 0;
                                cumulativeDistance += nextDist;
                            }
                            if (isNaN(currentLoc.time.getTime())) {
                                distanceMap[i] = cumulativeDistance;
                                continue;
                            }
                            distanceMap[i] = cumulativeDistance;
                        }

                        // Use the reference signal distance for ALL stops in this group
                        const nextSignal = referenceSignal;
                        const distanceToNextSignal = referenceDistanceToNextSignal;

                        // Note: Starter signal will be added as a common dataset at x=0, not individually

                        // Second pass: plot data using cumulative distance
                        let recorded100mException = false;
                        for (let i = stop.endIndex - 1; i >= 0; i--) {
                            const currentLoc = allLocations[i];
                            if (isNaN(currentLoc.time.getTime())) continue;

                            const currentPoint = turf.point([currentLoc.lon, currentLoc.lat]);
                            const distanceToStop = turf.distance(currentPoint, stopPoint, { units: 'meters' });

                            if (distanceToStop > 3100) break;

                            // Check for braking exceptions within 100m zone
                            if (distanceToStop <= 100 && !recorded100mException) {
                                // Record exception if speed exceeds 10 KMPH within 100m zone
                                if (currentLoc.speed > 10) {
                                    brakingExceptions.push({
                                        station: stop.station,
                                        location: 'Sigma Board (100m before stopping)',
                                        actualSpeed: currentLoc.speed,
                                        standardSpeed: 10,
                                        time: formatTime(currentLoc.time),
                                        distanceToStop: distanceToStop
                                    });
                                    recorded100mException = true;
                                }
                            }

                            brakingCheckpoints.forEach(cp => {
                                if (!checkedPoints.has(cp.name) && distanceToStop >= cp.distance) {
                                    checkedPoints.add(cp.name);
                                }
                            });

                            if (distanceToStop <= 3000) {
                                // Add distance to next signal to the x value
                                const xValue = distanceMap[i] + distanceToNextSignal;
                                // Only add if total distance from starter doesn't exceed 3200m
                                if (xValue <= 3200) {
                                    stopData.unshift({ x: xValue, y: currentLoc.speed });
                                }
                            }
                        }

                        const color = colors[index % colors.length];
                        //let legendLabel = `${stop.station} at ${formatTime(stop.time)}`;
                        let legendLabel = ``;
                        let signalText = '';
                        
                        if (nextSignal) {
                            signalText = `${nextSignal.station} (${nextSignal.type}) ${Math.round(nextSignal.distance)}m`;
                        }

                        // Check if signal type is "home" or "IBS" - these should go to Home Signals Analysis only
                        const signalTypeLowerCheck = nextSignal ? nextSignal.type.toLowerCase() : '';
                        const isHomeOrIBS = signalTypeLowerCheck.includes('home') || signalTypeLowerCheck.includes('ibs');

                        // Skip this dataset if distance to next signal is more than 1000m OR if it's a Home/IBS signal
                        if (!(nextSignal && nextSignal.distance > 1000) && !isHomeOrIBS) {
                            const legendEl = document.createElement('span');
                            legendEl.className = 'legend-item inline-flex flex-col items-start m-1 px-2 py-0.5 rounded-full text-xs font-medium';
                            legendEl.style.backgroundColor = `${color}20`;
                            legendEl.style.color = color;
                            legendEl.innerHTML = `<div class="legend-item-content"><div class="legend-item-text">${signalText}<br>${formatTime(stop.time)}</div><span class="legend-item-delete" title="Click to delete this dataset">✕</span></div>`;
                            legendEl.dataset.datasetIndex = datasets.length;
                            legendEl.title = `${signalText} - Stopped at ${formatTime(stop.time)}`;
                            stoppageLegend.appendChild(legendEl);

                            datasets.push({
                                label: legendLabel, data: stopData, borderColor: color,
                                borderWidth: 2.5, pointRadius: 0, tension: 0.1, originalBorderWidth: 2.5,
                                stopIndex: index,
                                signalInfo: nextSignal,
                                timeLabel: formatTime(stop.time)
                            });

                            // Add signal markers dataset for this specific stop
                            if (signalData && signalData.length > 0) {
                                const signalLatKey = findKey(signalData[0], ['Latitude']);
                                const signalLonKey = findKey(signalData[0], ['Longitude']);
                                const stationKey = findKey(signalData[0], ['Station', 'Location']);
                                const typeKey = findKey(signalData[0], ['Type']);
                                const stopSigKey = findKey(signalData[0], ['Designation Of Stop Signal']);
                                const permSigKey = findKey(signalData[0], ['Designation Of Permissive Signal']);
                                const dirKey = findKey(signalData[0], ['Direction', 'Dir']);
                            const signalLabelKey = findKey(signalData[0], ['Signal Label']);

                            if (signalLatKey && signalLonKey) {
                                const signalMarkersData = [];
                                const rawSignalData = []; // Collect all signals first for filtering

                                // Re-use the already calculated distanceMap from above (no need to recalculate)

                                // Re-use the already calculated distanceMap from above (no need to recalculate)

                                // Check which signals were passed in the braking period for this stop
                                // Find the nearest RTIS point to each signal for accurate speed reading
                                for (const signal of signalData) {
                                    // Filter signals by selected route SectionId
                                    if (!isSignalInSelectedRoute(signal)) continue;
                                    
                                    const signalLat = parseFloat(signal[signalLatKey]);
                                    const signalLon = parseFloat(signal[signalLonKey]);
                                    if (isNaN(signalLat) || isNaN(signalLon)) continue;

                                    const signalPoint = turf.point([signalLon, signalLat]);
                                    const signalType = signal[typeKey] || signal[stopSigKey] || signal[permSigKey] || 'Unknown';
                                    const signalStation = signal[stationKey] || 'N/A';
                                    const signalDirection = dirKey ? (signal[dirKey] || 'N/A') : 'N/A';

                                    // Find the nearest RTIS point to this signal within braking zone
                                    let nearestRtisIndex = -1;
                                    let minDistToSignal = Infinity;

                                    for (let i = stop.endIndex - 1; i >= 0; i--) {
                                        const currentLoc = allLocations[i];
                                        if (isNaN(currentLoc.time.getTime())) continue;

                                        const currentPoint = turf.point([currentLoc.lon, currentLoc.lat]);
                                        const distanceToStop = turf.distance(currentPoint, stopPoint, { units: 'meters' });

                                        if (distanceToStop > 3200) break; // Match dataset limit of 3200m

                                        const distToSignal = turf.distance(currentPoint, signalPoint, { units: 'meters' });

                                        // Track the nearest RTIS point to this signal
                                        if (distToSignal < minDistToSignal) {
                                            minDistToSignal = distToSignal;
                                            nearestRtisIndex = i;
                                        }
                                    }

                                    // Only add signal if nearest point is within threshold (same as Signal Analysis)
                                    if (nearestRtisIndex !== -1 && minDistToSignal < MAX_SIGNAL_DISTANCE_METERS) {
                                        const nearestLoc = allLocations[nearestRtisIndex];
                                        
                                        // Check if this signal is already in raw data
                                        const signalExists = rawSignalData.some(m => 
                                            m.signalStation === signalStation && m.signalType === signalType && m.direction === signalDirection
                                        );

                                        if (!signalExists) {
                                            const signalLabel = signalLabelKey ? signal[signalLabelKey] : null;
                                            rawSignalData.push({
                                                x: distanceMap[nearestRtisIndex] + distanceToNextSignal,
                                                y: nearestLoc.speed,
                                                signalType: signalType,
                                                signalStation: signalStation,
                                                direction: signalDirection,
                                                rtisIndex: nearestRtisIndex,
                                                signalLabel: signalLabel
                                            });
                                        }
                                    }
                                }

                            // Sort by rtisIndex to determine which signals were encountered first
                            rawSignalData.sort((a, b) => a.rtisIndex - b.rtisIndex);

                            // Determine train's direction based on approach signals (Distant/Home)
                            const directionCounts = new Map();
                            for (const sig of rawSignalData) {
                                const typeLower = sig.signalType.toLowerCase();
                                if (typeLower.includes('distant') || (typeLower.includes('home') || typeLower.includes('lss cum distant') || typeLower.includes('gs cum distant') && !typeLower.includes('starter'))) {
                                    const dir = sig.direction;
                                    if (dir && dir !== 'N/A') {
                                        directionCounts.set(dir, (directionCounts.get(dir) || 0) + 1);
                                    }
                                }
                            }

                            let trainDirection = null;
                            let maxCount = 0;
                            for (const [dir, count] of directionCounts) {
                                if (count > maxCount) {
                                    maxCount = count;
                                    trainDirection = dir;
                                }
                            }

                            // Track which stations were first encountered with approach vs departure
                            const stationFirstSignalType = new Map();
                            for (const sig of rawSignalData) {
                                // Only process signals matching train direction
                                if (trainDirection && sig.direction !== 'N/A' && sig.direction !== trainDirection) {
                                    continue;
                                }
                                
                                const typeLower = sig.signalType.toLowerCase();
                                const stationKey = sig.signalStation;
                                
                                if (!stationFirstSignalType.has(stationKey)) {
                                    if (typeLower.includes('distant') || (typeLower.includes('home') && !typeLower.includes('starter'))) {
                                        stationFirstSignalType.set(stationKey, 'approach');
                                    } else if (typeLower.includes('starter') || typeLower.includes('lss') || typeLower.includes('advanced')) {
                                        stationFirstSignalType.set(stationKey, 'departure');
                                    }
                                }
                            }

                            // Filter and add signals to markers
                            for (const sig of rawSignalData) {
                                const typeLower = sig.signalType.toLowerCase();
                                
                                // Skip signals beyond 3200m dataset limit
                                if (sig.x > 3200) {
                                    continue;
                                }
                                
                                // Filter by train direction - only show signals in the train's direction
                                if (trainDirection && sig.direction !== 'N/A' && sig.direction !== trainDirection) {
                                    continue;
                                }

                                // Skip starter signals - do not mark or label them (they are at x=0)
                                if (typeLower.includes('starter') || typeLower.includes('lss') || typeLower.includes('advanced')) {
                                    continue;
                                }

                                const stationKey = sig.signalStation;
                                const firstType = stationFirstSignalType.get(stationKey);

                                // If station was first encountered with Starter (train departing), skip approach signals
                                if (firstType === 'departure') {
                                    if ((typeLower.includes('distant') || (typeLower.includes('home') && !typeLower.includes('starter')))) {
                                        continue;
                                    }
                                }

                                let signalTypeShort = '';
                                if (typeLower.includes('home')) {
                                    signalTypeShort = 'HS';
                                } else if (typeLower.includes('distant')) {
                                    signalTypeShort = 'DS';
                                }
                                let signalLabel = '';
                                if (sig.signalLabel) {
                                    signalLabel = `${sig.signalLabel}(${sig.y.toFixed(1).replace(/\.0$/, '')})`;
                                } else {
                                    signalLabel = `${sig.signalStation}-${signalTypeShort}(${sig.y.toFixed(1).replace(/\.0$/, '')})`;
                                }

                                signalMarkersData.push({
                                    x: sig.x,
                                    y: sig.y,
                                    label: signalLabel,
                                    signalType: sig.signalType,
                                    signalStation: sig.signalStation
                                });
                            }

                            // Keep only the first two crossed signals for this dataset
                            if (signalMarkersData.length > 2) {
                                signalMarkersData.splice(2);
                            }

                            if (signalMarkersData.length > 0) {
                                datasets.push({
                                    label: `Signals for ${stop.station}`,
                                    type: 'scatter',
                                    data: signalMarkersData,
                                    pointRadius: 0,
                                    pointStyle: 'star',
                                    backgroundColor: '#FFD700',
                                    borderColor: '#FF6B6B',
                                    borderWidth: 2,
                                    tension: 0.1,
                                    stopIndex: index,
                                    isSignalDataset: true
                                });
                            }
                            }
                        }
                    }
                    });
                });

                // Add a single common Starter Signal marker at x=0 for all graphs
                datasets.push({
                    label: 'Starter Signal',
                    type: 'scatter',
                    data: [{ x: 0, y: 0, isCommonStarterSignal: true }],
                    pointRadius: 0,
                    pointStyle: 'circle',
                    backgroundColor: '#22c55e',
                    borderColor: '#16a34a',
                    borderWidth: 2,
                    tension: 0.1,
                    isCommonStarterSignal: true
                });

                const options = getChartOptions(null, 'Distance (Meters)', 'Speed (KMPH)');
                options.scales.x.reverse = true;
                options.scales.x.ticks.color = '#000000';
                options.scales.x.max = 3200; // Limit x-axis to 3200 meters max
                
                // Pre-load signal images (embedded as data URLs)
                const signalImages = {};
                const distantImg = new Image();
                const homeImg = new Image();
                const starterImg = new Image();
                
                // Embedded SVG data URLs
                distantImg.src = 'data:image/svg+xml;base64,' + btoa(`<?xml version="1.0"?><svg width="85" height="407" xmlns="http://www.w3.org/2000/svg"><g class="layer"><title>Layer 1</title><g data-cell-id="1" id="svg_3"><g data-cell-id="8Pz4FwjKvFX1z93biRRz-6" id="svg_4"><g id="svg_5"><path d="m42,405l0,-160" fill="none" id="svg_6" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--5" id="svg_7" transform="matrix(1 0 0 1 0 0)"><g id="svg_8"><ellipse cx="42.5" cy="45.5" fill="#ffff00" id="svg_9" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--6" id="svg_10" transform="matrix(1 0 0 1 0 0)"><g id="svg_11"><ellipse cx="42.5" cy="205.5" fill="#ffff00" id="svg_12" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="gzgGxNtp2YSv-8hrBadr-1" id="svg_13" transform="matrix(1 0 0 1 0 0)"><g id="svg_14" transform="translate(0.5 0.5)"><ellipse cx="42" cy="125" fill="#000000" id="svg_15" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g></g></g></svg>`);
                homeImg.src = 'data:image/svg+xml;base64,' + btoa(`<?xml version="1.0"?><svg width="297" height="437" xmlns="http://www.w3.org/2000/svg"><g class="layer"><title>Layer 1</title><g id="svg_1" transform="matrix(1 0 0 1 0 0)"><g data-cell-id="1" id="svg_3"><g data-cell-id="8Pz4FwjKvFX1z93biRRz-4" id="svg_4"><g id="svg_5" transform="translate(0.5,0.5)"><ellipse cx="143" cy="153" fill="#000000" id="svg_6" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-5" id="svg_7"><g id="svg_8" transform="translate(0.5,0.5)"><ellipse cx="143" cy="233" fill="#ffff00" id="svg_9" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-6" id="svg_10"><g id="svg_11"><path d="m143,433l0,-160" fill="none" id="svg_12" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-8" id="svg_13"><g id="svg_14"><path d="m293,11.28l-130,101.72" fill="none" id="svg_15" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-9" id="svg_16"><g id="svg_17"><path d="m3,3l120,110l-10,-8.28" fill="none" id="svg_18" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--1" id="svg_19"><g id="svg_20" transform="translate(0.5,0.5)"><ellipse cx="143" cy="153" fill="#ffff00" id="svg_21" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--2" id="svg_22"><g id="svg_23" transform="translate(0.5,0.5)"><ellipse cx="143" cy="73" fill="#000000" id="svg_24" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--3" id="svg_25"><g id="svg_26" transform="translate(0.5,0.5)"><ellipse cx="143" cy="233" fill="#000000" id="svg_27" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g></g></g></g></svg>`);
                starterImg.src = 'data:image/svg+xml;base64,' + btoa(`<?xml version="1.0"?><svg width="85" height="407" xmlns="http://www.w3.org/2000/svg"><g><g data-cell-id="0"><g data-cell-id="1"><g data-cell-id="8Pz4FwjKvFX1z93biRRz-4"><g transform="translate(0.5,0.5)"><ellipse cx="42" cy="122" rx="40" ry="40" fill="#000000" stroke="#000000" stroke-width="5"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-6"><g><path d="M 42 402 L 42 242" fill="none" stroke="#000000" stroke-width="6" stroke-miterlimit="10"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--5"><g transform="translate(0.5,0.5)"><ellipse cx="42" cy="42" rx="40" ry="40" fill="#ff0000" stroke="#000000" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--6"><g transform="translate(0.5,0.5)"><ellipse cx="42" cy="202" rx="40" ry="40" fill="#000000" stroke="#000000" stroke-width="5"/></g></g></g></g></g></svg>`);

                distantImg.onload = () => { signalImages['distant'] = distantImg; };
                homeImg.onload = () => { signalImages['home'] = homeImg; };
                starterImg.onload = () => { signalImages['starter'] = starterImg; };
                
                // Add plugin to display signal labels and icons on chart
                const signalLabelPlugin = {
                    afterDatasetsDraw(chart) {
                        const ctx = chart.ctx;
                        
                        // Draw common starter signal marker at x=0
                        chart.data.datasets.forEach((dataset, datasetIndex) => {
                            if (dataset.isCommonStarterSignal && !dataset.hidden && dataset.data) {
                                dataset.data.forEach((datapoint, index) => {
                                    if (datapoint.isCommonStarterSignal) {
                                        const point = chart.getDatasetMeta(datasetIndex).data[index];
                                        if (point) {
                                            if (signalImages['starter']) {
                                                // Draw Starter signal image at x=0
                                                ctx.drawImage(signalImages['starter'], point.x - 5, point.y - 38, 10, 36);
                                            }
                                        }
                                    }
                                });
                            }
                        });
                        
                        chart.data.datasets.forEach((dataset, datasetIndex) => {
                            if (dataset.isSignalDataset && !dataset.hidden) {
                                dataset.data.forEach((datapoint, index) => {
                                    if (datapoint.label) {
                                        // Skip rendering labels for starter signals
                                        if (datapoint.signalType && datapoint.signalType.toLowerCase().includes('starter')) {
                                            return;
                                        }
                                        const point = chart.getDatasetMeta(datasetIndex).data[index];
                                        if (point) {
                                            const x = point.x;
                                            const y = point.y;
                                            const signalType = (datapoint.signalType || '').toLowerCase();
                                            
                                            // Draw custom icon or image based on signal type
                                            if ((signalType.includes('distant') || signalType.includes('lss cum distant') || signalType.includes('gs cum distant') || signalType.includes('ib distant')) && signalImages['distant']) {
                                                // Draw Distant signal image (DS, LSSDS, GSDS, or IB Distant)
                                                ctx.drawImage(signalImages['distant'], x - 6, y - 32, 10, 30);
                                            } else if (signalType.includes('home') && signalImages['home']) {
                                                // Draw Home signal image
                                                ctx.drawImage(signalImages['home'], x - 6, y - 34, 30, 36);
                                            } else if (signalType.includes('distant') || signalType.includes('lss cum distant') || signalType.includes('gs cum distant') || signalType.includes('ib distant')) {
                                                // Fallback: Draw double yellow circle for Distant signal (DS, LSSDS, GSDS, or IB Distant)
                                                ctx.fillStyle = '#FFD700';
                                                ctx.beginPath();
                                                ctx.arc(x - 12, y, 6, 0, 2 * Math.PI);
                                                ctx.fill();
                                                ctx.fillStyle = '#FFD700';
                                                ctx.beginPath();
                                                ctx.arc(x + 12, y, 6, 0, 2 * Math.PI);
                                                ctx.fill();
                                                // Draw connecting line
                                                ctx.strokeStyle = '#FFD700';
                                                ctx.lineWidth = 2;
                                                ctx.beginPath();
                                                ctx.moveTo(x - 6, y);
                                                ctx.lineTo(x + 6, y);
                                                ctx.stroke();
                                            } else if (signalType.includes('home')) {
                                                // Fallback: Draw single red circle for Home signal
                                                ctx.fillStyle = '#FF0000';
                                                ctx.beginPath();
                                                ctx.arc(x, y, 8, 0, 2 * Math.PI);
                                                ctx.fill();
                                                // Draw white inner circle
                                                ctx.fillStyle = '#FFFFFF';
                                                ctx.beginPath();
                                                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                                                ctx.fill();
                                            } else {
                                                // Default star marker for other signals
                                                ctx.fillStyle = '#FFD700';
                                                ctx.font = 'bold 14px Arial';
                                                ctx.textAlign = 'center';
                                                ctx.textBaseline = 'middle';
                                                ctx.fillText('★', x, y);
                                            }
                                            
                                            // Draw label text below icon
                                            ctx.fillStyle = '#000000';
                                            ctx.font = 'bold 10px Arial';
                                            ctx.textAlign = 'center';
                                            ctx.fillText(datapoint.label, x, y - 38);
                                        }
                                    }
                                });
                            }
                        });
                    }
                };
                
                stoppingAnalysisChart = plotChart('stoppingAnalysisChart', { datasets }, options, [signalLabelPlugin]);

                // Cache the chart data for creating additional graphs
                brakeChartDataCache = {
                    datasets: datasets,
                    options: options,
                    plugins: [signalLabelPlugin]
                };

                stoppageLegend.querySelectorAll('.legend-item').forEach(item => {
                    // Handle left-click to toggle visibility
                    item.addEventListener('click', (e) => {
                        // Don't toggle if clicking the delete button
                        if (e.target.classList.contains('legend-item-delete')) {
                            e.stopPropagation();
                            return;
                        }

                        const clickedIndex = parseInt(item.dataset.datasetIndex);
                        const clickedDataset = stoppingAnalysisChart.data.datasets[clickedIndex];

                        // Toggle visibility of clicked dataset
                        clickedDataset.hidden = !clickedDataset.hidden;

                        // Visual cue on legend
                        item.classList.toggle('striked', clickedDataset.hidden);

                        // Also toggle signal markers for this specific stop
                        const stopIndex = clickedDataset.stopIndex;
                        stoppingAnalysisChart.data.datasets.forEach((dataset, idx) => {
                            if (dataset.isSignalDataset && dataset.stopIndex === stopIndex) {
                                dataset.hidden = clickedDataset.hidden;
                            }
                        });

                        // Update toggle button state
                        const allLegends = stoppageLegend.querySelectorAll('.legend-item');
                        const allHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));
                        const toggleBtn = document.getElementById('toggle-all-brake-legends');
                        if (toggleBtn) {
                            toggleBtn.classList.toggle('active', allHidden && allLegends.length > 0);
                        }

                        stoppingAnalysisChart.update();
                    });

                    // Handle delete button click
                    const deleteBtn = item.querySelector('.legend-item-delete');
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            
                            const datasetIndex = parseInt(item.dataset.datasetIndex);
                            const stopIndex = stoppingAnalysisChart.data.datasets[datasetIndex].stopIndex;

                            // Remove dataset from chart
                            stoppingAnalysisChart.data.datasets.splice(datasetIndex, 1);

                            // Also remove any associated signal datasets for this stop
                            for (let i = stoppingAnalysisChart.data.datasets.length - 1; i >= 0; i--) {
                                const ds = stoppingAnalysisChart.data.datasets[i];
                                if (ds.isSignalDataset && ds.stopIndex === stopIndex) {
                                    stoppingAnalysisChart.data.datasets.splice(i, 1);
                                }
                            }

                            // Remove legend item from DOM
                            item.remove();

                            // Update dataset indices for remaining legend items
                            stoppageLegend.querySelectorAll('.legend-item').forEach((legendItem, idx) => {
                                // Find the correct dataset index based on position
                                let correctIndex = 0;
                                for (let i = 0; i < stoppingAnalysisChart.data.datasets.length; i++) {
                                    if (!stoppingAnalysisChart.data.datasets[i].isSignalDataset && !stoppingAnalysisChart.data.datasets[i].isCommonStarterSignal) {
                                        if (correctIndex === idx) {
                                            legendItem.dataset.datasetIndex = i;
                                            break;
                                        }
                                        correctIndex++;
                                    }
                                }
                            });

                            // Update toggle button state
                            const allLegends = stoppageLegend.querySelectorAll('.legend-item');
                            const allHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));
                            const toggleBtn = document.getElementById('toggle-all-brake-legends');
                            if (toggleBtn) {
                                toggleBtn.classList.toggle('active', allHidden && allLegends.length > 0);
                            }

                            stoppingAnalysisChart.update();
                        });
                    }
                });

                // Handle toggle all button
                const toggleAllBtn = document.getElementById('toggle-all-brake-legends');
                if (toggleAllBtn) {
                    toggleAllBtn.addEventListener('click', () => {
                        // Show loading overlay
                        const overlay = document.getElementById('page-loading-overlay');
                        if (overlay) overlay.classList.add('active');

                        // Use setTimeout to allow the overlay to render before heavy processing
                        setTimeout(() => {
                            const allLegends = stoppageLegend.querySelectorAll('.legend-item');
                            const isCurrentlyAllHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));

                            allLegends.forEach((legendItem, legendIndex) => {
                                // Find the corresponding dataset by position (accounting for signal datasets)
                                let datasetCount = 0;
                                let dataset = null;
                                
                                for (let i = 0; i < stoppingAnalysisChart.data.datasets.length; i++) {
                                    if (!stoppingAnalysisChart.data.datasets[i].isSignalDataset && !stoppingAnalysisChart.data.datasets[i].isCommonStarterSignal) {
                                        if (datasetCount === legendIndex) {
                                            dataset = stoppingAnalysisChart.data.datasets[i];
                                            break;
                                        }
                                        datasetCount++;
                                    }
                                }

                                if (!dataset) return;

                                // Set hidden state based on current state
                                if (isCurrentlyAllHidden) {
                                    // If all are hidden, show all
                                    dataset.hidden = false;
                                    legendItem.classList.remove('striked');
                                } else {
                                    // If not all are hidden, hide all
                                    dataset.hidden = true;
                                    legendItem.classList.add('striked');
                                }

                                // Also toggle signal markers for this specific stop
                                const stopIndex = dataset.stopIndex;
                                stoppingAnalysisChart.data.datasets.forEach((ds, idx) => {
                                    if (ds.isSignalDataset && ds.stopIndex === stopIndex) {
                                        ds.hidden = dataset.hidden;
                                    }
                                });
                            });

                            // Update toggle button state
                            const allNowHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));
                            toggleAllBtn.classList.toggle('active', allNowHidden && allLegends.length > 0);

                            stoppingAnalysisChart.update();

                            // Hide loading overlay after processing
                            if (overlay) overlay.classList.remove('active');
                        }, 50);
                    });
                }

                // Handle toggle Home Signals chart button
                const toggleHomeSignalsBtn = document.getElementById('toggle-home-signals-chart');
                if (toggleHomeSignalsBtn) {
                    toggleHomeSignalsBtn.addEventListener('click', () => {
                        // Show loading overlay
                        const overlay = document.getElementById('page-loading-overlay');
                        if (overlay) overlay.classList.add('active');

                        // Use setTimeout to allow the overlay to render before heavy processing
                        setTimeout(() => {
                            const chartContainer = document.getElementById('home-signals-chart-container');
                            const parentSection = toggleHomeSignalsBtn.closest('.chart-section');
                            if (chartContainer) {
                                chartContainer.classList.toggle('hidden');
                                if (!chartContainer.classList.contains('hidden')) {
                                    toggleHomeSignalsBtn.textContent = 'Hide Home Signals';
                                    // Adjust parent section height to accommodate both charts
                                    if (parentSection) {
                                        parentSection.style.minHeight = 'auto';
                                    }
                                    // Resize chart when it becomes visible
                                    if (homeSignalsAnalysisChart) {
                                        setTimeout(() => {
                                            homeSignalsAnalysisChart.resize();
                                            // Hide loading overlay after chart resize
                                            if (overlay) overlay.classList.remove('active');
                                        }, 100);
                                        return; // Exit early, overlay will be hidden after resize
                                    }
                                } else {
                                    toggleHomeSignalsBtn.textContent = 'Show Home Signals';
                                    // Reset parent section height
                                    if (parentSection) {
                                        parentSection.style.minHeight = '';
                                    }
                                }
                            }
                            // Hide loading overlay after processing
                            if (overlay) overlay.classList.remove('active');
                        }, 50);
                    });
                }

                // Handle toggle all button for home signals legends
                const toggleAllHomeBtn = document.getElementById('toggle-all-home-legends');
                const homeStoppageLegend = document.getElementById('home-stoppage-legend');
                if (toggleAllHomeBtn && homeStoppageLegend) {
                    toggleAllHomeBtn.addEventListener('click', () => {
                        if (!homeSignalsAnalysisChart) return;
                        
                        // Show loading overlay
                        const overlay = document.getElementById('page-loading-overlay');
                        if (overlay) overlay.classList.add('active');

                        // Use setTimeout to allow the overlay to render before heavy processing
                        setTimeout(() => {
                            const allLegends = homeStoppageLegend.querySelectorAll('.legend-item');
                            const isCurrentlyAllHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));

                            allLegends.forEach((legendItem, legendIndex) => {
                                // Find the corresponding dataset by position (accounting for signal datasets)
                                let datasetCount = 0;
                                let dataset = null;
                                
                                for (let i = 0; i < homeSignalsAnalysisChart.data.datasets.length; i++) {
                                    if (!homeSignalsAnalysisChart.data.datasets[i].isSignalDataset && !homeSignalsAnalysisChart.data.datasets[i].isCommonStarterSignal) {
                                        if (datasetCount === legendIndex) {
                                            dataset = homeSignalsAnalysisChart.data.datasets[i];
                                            break;
                                        }
                                        datasetCount++;
                                    }
                                }

                                if (!dataset) return;

                                // Set hidden state based on current state
                                if (isCurrentlyAllHidden) {
                                    // If all are hidden, show all
                                    dataset.hidden = false;
                                    legendItem.classList.remove('striked');
                                } else {
                                    // If not all are hidden, hide all
                                    dataset.hidden = true;
                                    legendItem.classList.add('striked');
                                }

                                // Also toggle signal markers for this specific stop
                                const stopIndex = dataset.stopIndex;
                                homeSignalsAnalysisChart.data.datasets.forEach((ds, idx) => {
                                    if (ds.isSignalDataset && ds.stopIndex === stopIndex) {
                                        ds.hidden = dataset.hidden;
                                    }
                                });
                            });

                            // Update toggle button state
                            const allNowHidden = Array.from(allLegends).every(l => l.classList.contains('striked'));
                            toggleAllHomeBtn.classList.toggle('active', allNowHidden && allLegends.length > 0);

                            homeSignalsAnalysisChart.update();

                            // Hide loading overlay after processing
                            if (overlay) overlay.classList.remove('active');
                        }, 50);
                    });
                }

                // Handle print button
                const printBrakeBtn = document.getElementById('print-brake-analysis');
                if (printBrakeBtn) {
                    printBrakeBtn.addEventListener('click', () => {
                        // Get the Braking Analysis section
                        const brakingSection = printBrakeBtn.closest('.chart-section');
                        if (!brakingSection) return;

                        // Create a new window for printing
                        const printWindow = window.open('', '_blank');
                        printWindow.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">');
                        printWindow.document.write('<title>Braking Analysis Report</title>');
                        printWindow.document.write('<style>');
                        printWindow.document.write('body { font-family: Arial, sans-serif; margin: 20px; }');
                        printWindow.document.write('h2 { text-align: center; color: #1f2937; margin-bottom: 20px; }');
                        printWindow.document.write('h3 { text-align: center; color: #1f2937; margin-top: 20px; margin-bottom: 10px; }');
                        printWindow.document.write('canvas { max-width: 100%; height: auto; margin-bottom: 30px; }');
                        printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
                        printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
                        printWindow.document.write('th { background-color: #f3f4f6; font-weight: bold; }');
                        printWindow.document.write('tr:nth-child(even) { background-color: #f9fafb; }');
                        printWindow.document.write('</style></head><body>');
                        
                        // Add title
                        printWindow.document.write('<h2>4. Braking Analysis Report</h2>');
                        
                        // Add legend
                        const legendContainer = brakingSection.querySelector('#stoppageLegend');
                        if (legendContainer) {
                            printWindow.document.write('<div style="margin-bottom: 20px; text-align: center;">');
                            const legendItems = Array.from(legendContainer.querySelectorAll('.legend-item')).map(item => {
                                const text = item.textContent;
                                const color = item.style.color;
                                const isStriked = item.classList.contains('striked');
                                const decoration = isStriked ? 'line-through' : 'none';
                                return `<span style="display: inline-block; margin: 5px 10px; color: ${color}; text-decoration: ${decoration}; font-weight: 500;">${text}</span>`;
                            });
                            printWindow.document.write(legendItems.join(''));
                            printWindow.document.write('</div>');
                        }

                        // Add chart as image
                        printWindow.document.write('<div style="text-align: center;">');
                        const chartImage = stoppingAnalysisChart.toDataURL();
                        printWindow.document.write(`<img src="${chartImage}" style="max-width: 100%; height: auto;">`);
                        printWindow.document.write('</div>');
                        
                        // Add speed analysis table
                        printWindow.document.write('<h3>Speed Analysis before Stop</h3>');
                        
                        // Add common fields
                        const commonDate = document.getElementById('commonDate')?.value || '';
                        const commonTrainNo = document.getElementById('commonTrainNo')?.value || '';
                        const commonLPName = document.getElementById('commonLPName')?.value || '';
                        const commonLoad = document.getElementById('commonLoad')?.value || '';
                        const commonNLI = document.getElementById('commonNLI')?.value || '';
                        
                        printWindow.document.write('<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 15px; padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 5px;">');
                        printWindow.document.write(`<div><strong>Date:</strong> ${commonDate}</div>`);
                        printWindow.document.write(`<div><strong>Train No:</strong> ${commonTrainNo}</div>`);
                        printWindow.document.write(`<div><strong>LP Name:</strong> ${commonLPName}</div>`);
                        printWindow.document.write(`<div><strong>Load:</strong> ${commonLoad}</div>`);
                        printWindow.document.write(`<div><strong>NLI:</strong> ${commonNLI}</div>`);
                        printWindow.document.write('</div>');
                        
                        const speedTable = brakingSection.querySelector('#speedTable');
                        if (speedTable) {
                            printWindow.document.write(speedTable.outerHTML);
                        }
                        
                        // Add braking exceptions table if present
                        const printBrakingExceptionsContainer = document.getElementById('braking-exceptions-container');
                        if (printBrakingExceptionsContainer && !printBrakingExceptionsContainer.classList.contains('hidden')) {
                            printWindow.document.write('<h3>Braking Exceptions</h3>');
                            const exceptionTable = printBrakingExceptionsContainer.querySelector('table');
                            if (exceptionTable) {
                                printWindow.document.write(exceptionTable.outerHTML);
                            }
                        }
                        
                        printWindow.document.write('</body></html>');
                        printWindow.document.close();
                        
                        // Trigger print dialog
                        setTimeout(() => {
                            printWindow.print();
                            printWindow.close();
                        }, 250);
                    });
                }

                displayBrakingExceptions();
            }

            function plotHomeSignalsChart() {
                const STOP_SPEED_THRESHOLD = 2;
                const MIN_STOP_DURATION_SECONDS = 10;
                let stops = [];
                let potentialStopStartIdx = -1;
                let potentialStopEndIdx = -1;

                allLocations.forEach((loc, i) => {
                    if (isNaN(loc.time.getTime())) return;
                    const isStopped = loc.speed < STOP_SPEED_THRESHOLD;
                    if (isStopped && potentialStopStartIdx === -1) {
                        potentialStopStartIdx = i;
                        potentialStopEndIdx = i;
                    } else if (isStopped && potentialStopStartIdx !== -1) {
                        // Keep updating the end index to the last stopped point
                        potentialStopEndIdx = i;
                    } else if (!isStopped && potentialStopStartIdx !== -1) {
                        const duration = (allLocations[potentialStopEndIdx].time.getTime() - allLocations[potentialStopStartIdx].time.getTime()) / 1000;
                        if (duration >= MIN_STOP_DURATION_SECONDS) {
                            // Use potentialStopEndIdx which is the last point BEFORE train restarted
                            stops.push({ endIndex: potentialStopEndIdx, station: allLocations[potentialStopEndIdx].station || 'N/A', time: allLocations[potentialStopEndIdx].time });
                        }
                        potentialStopStartIdx = -1;
                        potentialStopEndIdx = -1;
                    }
                });

                if (potentialStopStartIdx !== -1) {
                    const lastIndex = allLocations.length - 1;
                    if (!isNaN(allLocations[lastIndex].time.getTime())) {
                        // Update potentialStopEndIdx to last index if still in stopped state
                        if (potentialStopEndIdx === -1 || allLocations[lastIndex].speed < STOP_SPEED_THRESHOLD) {
                            potentialStopEndIdx = lastIndex;
                        }
                        const duration = (allLocations[potentialStopEndIdx].time.getTime() - allLocations[potentialStopStartIdx].time.getTime()) / 1000;
                        if (duration >= MIN_STOP_DURATION_SECONDS) {
                            stops.push({ endIndex: potentialStopEndIdx, station: allLocations[potentialStopEndIdx].station || 'N/A', time: allLocations[potentialStopEndIdx].time });
                        }
                    }
                }

                const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#1a9850', '#d6604d', '#4575b4', '#181515'];
                const datasets = [];
                let homeStopCount = 0;

                stops.map((stop, index) => {
                    const stopPoint = turf.point([allLocations[stop.endIndex].lon, allLocations[stop.endIndex].lat]);
                    
                    // Get the nearest signal to the stop point
                    const nextSignal = findNextSignalAfterStop(stopPoint);
                    
                    // Check if the nearest signal type is "home" or "IBS"
                    const signalTypeLower = nextSignal ? nextSignal.type.toLowerCase() : '';
                    const isHomeOrIBS = signalTypeLower.includes('home') || signalTypeLower.includes('ibs');
                    
                    // Only include stops where the nearest signal is Home or IBS
                    if (!isHomeOrIBS) return;

                    homeStopCount++;
                    const stopData = [];
                    let checkedPoints = new Set();

                    // Calculate cumulative distance for braking curve
                    let cumulativeDistance = 0;
                    const distanceMap = [];
                    
                    // First pass: calculate cumulative distances backwards from stop
                    for (let i = stop.endIndex - 1; i >= 0; i--) {
                        const currentLoc = allLocations[i];
                        if (isNaN(currentLoc.time.getTime())) {
                            distanceMap[i] = cumulativeDistance;
                            continue;
                        }
                        distanceMap[i] = cumulativeDistance;
                        if (i < stop.endIndex - 1 && allLocations[i + 1]) {
                            const nextDist = allLocations[i + 1].distFromPrev || 0;
                            cumulativeDistance += nextDist;
                        }
                    }

                    // Get the distance to next signal (Home/IBS signal) after stopping
                    const distanceToNextSignal = nextSignal ? nextSignal.distance : 0;

                    // Second pass: plot data using cumulative distance
                    for (let i = stop.endIndex - 1; i >= 0; i--) {
                        const currentLoc = allLocations[i];
                        if (isNaN(currentLoc.time.getTime())) continue;

                        const currentPoint = turf.point([currentLoc.lon, currentLoc.lat]);
                        const distanceToStop = turf.distance(currentPoint, stopPoint, { units: 'meters' });

                        if (distanceToStop > 3100) break;

                        if (distanceToStop <= 3000) {
                            const xValue = distanceMap[i] + distanceToNextSignal;
                            if (xValue <= 3200) {
                                stopData.unshift({ x: xValue, y: currentLoc.speed });
                            }
                        }
                    }

                    const color = colors[(homeStopCount - 1) % colors.length];
                    let signalText = '';
                    
                    if (nextSignal) {
                        signalText = `${nextSignal.station} (${nextSignal.type}) ${Math.round(nextSignal.distance)}m`;
                    }

                    datasets.push({
                        label: '', data: stopData, borderColor: color,
                        borderWidth: 2.5, pointRadius: 0, tension: 0.1, originalBorderWidth: 2.5,
                        stopIndex: index,
                        isHomeSignalStop: true,
                        stopInfo: { station: stop.station, time: stop.time, signalText: signalText }
                    });

                    // Add signal markers dataset for this specific stop
                    if (signalData && signalData.length > 0) {
                        const signalLatKey = findKey(signalData[0], ['Latitude']);
                        const signalLonKey = findKey(signalData[0], ['Longitude']);
                        const stationKey = findKey(signalData[0], ['Station', 'Location']);
                        const typeKey = findKey(signalData[0], ['Type']);
                        const stopSigKey = findKey(signalData[0], ['Designation Of Stop Signal']);
                        const permSigKey = findKey(signalData[0], ['Designation Of Permissive Signal']);
                        const dirKey = findKey(signalData[0], ['Direction', 'Dir']);
                        const signalLabelKey = findKey(signalData[0], ['Signal Label']);

                        if (signalLatKey && signalLonKey) {
                            const signalMarkersData = [];
                            const rawSignalData = [];

                            const distanceMap = [];
                            let cumulativeDistance = 0;
                            for (let i = stop.endIndex - 1; i >= 0; i--) {
                                const currentLoc = allLocations[i];
                                if (isNaN(currentLoc.time.getTime())) {
                                    distanceMap[i] = cumulativeDistance;
                                    continue;
                                }
                                distanceMap[i] = cumulativeDistance;
                                if (i < stop.endIndex - 1 && allLocations[i + 1]) {
                                    const nextDist = allLocations[i + 1].distFromPrev || 0;
                                    cumulativeDistance += nextDist;
                                }
                            }

                            for (const signal of signalData) {
                                // Filter signals by selected route SectionId
                                if (!isSignalInSelectedRoute(signal)) continue;
                                
                                const signalLat = parseFloat(signal[signalLatKey]);
                                const signalLon = parseFloat(signal[signalLonKey]);
                                if (isNaN(signalLat) || isNaN(signalLon)) continue;

                                const signalPoint = turf.point([signalLon, signalLat]);
                                const signalType = signal[typeKey] || signal[stopSigKey] || signal[permSigKey] || 'Unknown';
                                const signalStation = signal[stationKey] || 'N/A';
                                const signalDirection = dirKey ? (signal[dirKey] || 'N/A') : 'N/A';

                                // Find the nearest RTIS point to this signal within braking zone
                                let nearestRtisIndex = -1;
                                let minDistToSignal = Infinity;

                                for (let i = stop.endIndex - 1; i >= 0; i--) {
                                    const currentLoc = allLocations[i];
                                    if (isNaN(currentLoc.time.getTime())) continue;

                                    const currentPoint = turf.point([currentLoc.lon, currentLoc.lat]);
                                    const distanceToStop = turf.distance(currentPoint, stopPoint, { units: 'meters' });

                                    if (distanceToStop > 3200) break;

                                    const distToSignal = turf.distance(currentPoint, signalPoint, { units: 'meters' });

                                    if (distToSignal < minDistToSignal) {
                                        minDistToSignal = distToSignal;
                                        nearestRtisIndex = i;
                                    }
                                }

                                if (nearestRtisIndex !== -1 && minDistToSignal < MAX_SIGNAL_DISTANCE_METERS) {
                                    const nearestLoc = allLocations[nearestRtisIndex];
                                    
                                    const signalExists = rawSignalData.some(m => 
                                        m.signalStation === signalStation && m.signalType === signalType && m.direction === signalDirection
                                    );

                                    if (!signalExists) {
                                        const signalLabel = signalLabelKey ? signal[signalLabelKey] : null;
                                        rawSignalData.push({
                                            x: distanceMap[nearestRtisIndex] + distanceToNextSignal,
                                            y: nearestLoc.speed,
                                            signalType: signalType,
                                            signalStation: signalStation,
                                            direction: signalDirection,
                                            rtisIndex: nearestRtisIndex,
                                            signalLabel: signalLabel
                                        });
                                    }
                                }
                            }

                            rawSignalData.sort((a, b) => a.rtisIndex - b.rtisIndex);

                            const directionCounts = new Map();
                            for (const sig of rawSignalData) {
                                const typeLower = sig.signalType.toLowerCase();
                                if (typeLower.includes('distant') || (typeLower.includes('home') && !typeLower.includes('starter'))) {
                                    const dir = sig.direction;
                                    if (dir && dir !== 'N/A') {
                                        directionCounts.set(dir, (directionCounts.get(dir) || 0) + 1);
                                    }
                                }
                            }

                            let trainDirection = null;
                            let maxCount = 0;
                            for (const [dir, count] of directionCounts) {
                                if (count > maxCount) {
                                    maxCount = count;
                                    trainDirection = dir;
                                }
                            }

                            const stationFirstSignalType = new Map();
                            for (const sig of rawSignalData) {
                                if (trainDirection && sig.direction !== 'N/A' && sig.direction !== trainDirection) {
                                    continue;
                                }
                                
                                const typeLower = sig.signalType.toLowerCase();
                                const stationKey = sig.signalStation;
                                
                                if (!stationFirstSignalType.has(stationKey)) {
                                    if (typeLower.includes('distant') || (typeLower.includes('home') && !typeLower.includes('starter'))) {
                                        stationFirstSignalType.set(stationKey, 'approach');
                                    } else if (typeLower.includes('starter') || typeLower.includes('lss') || typeLower.includes('advanced')) {
                                        stationFirstSignalType.set(stationKey, 'departure');
                                    }
                                }
                            }

                            // Find the last crossed distant signal only
                            let lastDistantSignal = null;
                            
                            for (const sig of rawSignalData) {
                                const typeLower = sig.signalType.toLowerCase();
                                
                                if (sig.x > 3200) {
                                    continue;
                                }
                                
                                if (trainDirection && sig.direction !== 'N/A' && sig.direction !== trainDirection) {
                                    continue;
                                }

                                // Only consider Distant signals (DS, LSSDS, GSDS, or IB Distant)
                                if ((typeLower.includes('distant') || typeLower.includes('lss cum distant') || typeLower.includes('gs cum distant') || typeLower.includes('ib distant')) && !typeLower.includes('home') && !typeLower.includes('starter')) {
                                    // Keep updating to get the last one
                                    lastDistantSignal = sig;
                                }
                            }
                            
                            // Only add the last distant signal to markers
                            if (lastDistantSignal) {
                                const sig = lastDistantSignal;
                                const typeLower = sig.signalType.toLowerCase();
                                const signalTypeShort = 'DS';
                                
                                let signalLabel = '';
                                if (sig.signalLabel) {
                                    signalLabel = `${sig.signalLabel}(${sig.y.toFixed(1).replace(/\.0$/, '')})`;
                                } else {
                                    signalLabel = `${sig.signalStation}-${signalTypeShort}(${sig.y.toFixed(1).replace(/\.0$/, '')})`;
                                }

                                signalMarkersData.push({
                                    x: sig.x,
                                    y: sig.y,
                                    label: signalLabel,
                                    signalType: sig.signalType,
                                    signalStation: sig.signalStation
                                });
                            }

                            if (signalMarkersData.length > 0) {
                                datasets.push({
                                    label: `Home Signals for ${stop.station}`,
                                    type: 'scatter',
                                    data: signalMarkersData,
                                    pointRadius: 0,
                                    pointStyle: 'star',
                                    backgroundColor: '#FFD700',
                                    borderColor: '#FF6B6B',
                                    borderWidth: 2,
                                    tension: 0.1,
                                    stopIndex: index,
                                    isSignalDataset: true
                                });
                            }
                        }
                    }
                });

                // If no Home signal stops found, hide the chart
                if (homeStopCount === 0) {
                    const chartContainer = document.getElementById('home-signals-chart-container');
                    const toggleBtn = document.getElementById('toggle-home-signals-chart');
                    if (chartContainer) chartContainer.classList.add('hidden');
                    if (toggleBtn) toggleBtn.style.display = 'none';
                    if (homeSignalsAnalysisChart) homeSignalsAnalysisChart.destroy();
                    return;
                }

                // Show the button and container if there are Home signal stops
                const toggleBtn = document.getElementById('toggle-home-signals-chart');
                if (toggleBtn) toggleBtn.style.display = 'inline-block';

                // Add a single common Home Signal marker at x=0 for all graphs
                datasets.push({
                    label: 'Home Signal',
                    type: 'scatter',
                    data: [{ x: 0, y: 0, isCommonHomeSignal: true }],
                    pointRadius: 0,
                    pointStyle: 'circle',
                    backgroundColor: '#FF0000',
                    borderColor: '#B22222',
                    borderWidth: 2,
                    tension: 0.1,
                    isCommonHomeSignal: true
                });

                const options = getChartOptions(null, 'Distance (Meters)', 'Speed (KMPH)');
                options.scales.x.reverse = true;
                options.scales.x.max = 3200;
                options.scales.x.min = 0;
                options.scales.x.type = 'linear';
                options.scales.x.ticks = { stepSize: 300, display: true };
                options.scales.x.display = true;
                options.scales.y.beginAtZero = true;
                options.scales.y.min = 0;

                // Pre-load signal images
                const signalImages = {};
                const distantImg = new Image();
                const homeImg = new Image();
                const distantCautionImg = new Image();
                const homeDangerImg = new Image();
                distantImg.src = 'data:image/svg+xml;base64,' + btoa(`<?xml version="1.0"?><svg width="85" height="407" xmlns="http://www.w3.org/2000/svg"><g class="layer"><title>Layer 1</title><g data-cell-id="1" id="svg_3"><g data-cell-id="8Pz4FwjKvFX1z93biRRz-6" id="svg_4"><g id="svg_5"><path d="m42,405l0,-160" fill="none" id="svg_6" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--5" id="svg_7" transform="matrix(1 0 0 1 0 0)"><g id="svg_8"><ellipse cx="42.5" cy="45.5" fill="#ffff00" id="svg_9" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--6" id="svg_10" transform="matrix(1 0 0 1 0 0)"><g id="svg_11"><ellipse cx="42.5" cy="205.5" fill="#ffff00" id="svg_12" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="gzgGxNtp2YSv-8hrBadr-1" id="svg_13" transform="matrix(1 0 0 1 0 0)"><g id="svg_14" transform="translate(0.5 0.5)"><ellipse cx="42" cy="125" fill="#000000" id="svg_15" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g></g></g></svg>`);
                homeImg.src = 'data:image/svg+xml;base64,' + btoa(`<?xml version="1.0"?><svg width="297" height="437" xmlns="http://www.w3.org/2000/svg"><g class="layer"><title>Layer 1</title><g id="svg_1" transform="matrix(1 0 0 1 0 0)"><g data-cell-id="1" id="svg_3"><g data-cell-id="8Pz4FwjKvFX1z93biRRz-4" id="svg_4"><g id="svg_5" transform="translate(0.5,0.5)"><ellipse cx="143" cy="153" fill="#000000" id="svg_6" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-5" id="svg_7"><g id="svg_8" transform="translate(0.5,0.5)"><ellipse cx="143" cy="233" fill="#ffff00" id="svg_9" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-6" id="svg_10"><g id="svg_11"><path d="m143,433l0,-160" fill="none" id="svg_12" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-8" id="svg_13"><g id="svg_14"><path d="m293,11.28l-130,101.72" fill="none" id="svg_15" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-9" id="svg_16"><g id="svg_17"><path d="m3,3l120,110l-10,-8.28" fill="none" id="svg_18" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--1" id="svg_19"><g id="svg_20" transform="translate(0.5,0.5)"><ellipse cx="143" cy="153" fill="#ff0000" id="svg_21" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--2" id="svg_22"><g id="svg_23" transform="translate(0.5,0.5)"><ellipse cx="143" cy="73" fill="#000000" id="svg_24" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--3" id="svg_25"><g id="svg_26" transform="translate(0.5,0.5)"><ellipse cx="143" cy="233" fill="#000000" id="svg_27" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g></g></g></g></svg>`);
                distantCautionImg.src = 'data:image/svg+xml;base64,' + btoa(`<?xml version="1.0"?><svg width="85" height="407" xmlns="http://www.w3.org/2000/svg"><g class="layer"><title>Layer 1</title><g data-cell-id="1" id="svg_3"><g data-cell-id="8Pz4FwjKvFX1z93biRRz-6" id="svg_4"><g id="svg_5"><path d="m42,405l0,-160" fill="none" id="svg_6" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--5" id="svg_7" transform="matrix(1 0 0 1 0 0)"><g id="svg_8"><ellipse cx="42.5" cy="45.5" fill="#ffff00" id="svg_9" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--6" id="svg_10" transform="matrix(1 0 0 1 0 0)"><g id="svg_11"><ellipse cx="42.5" cy="205.5" fill="#000000" id="svg_12" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="gzgGxNtp2YSv-8hrBadr-1" id="svg_13" transform="matrix(1 0 0 1 0 0)"><g id="svg_14" transform="translate(0.5 0.5)"><ellipse cx="42" cy="125" fill="#000000" id="svg_15" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g></g></g></svg>`);
                homeDangerImg.src = 'data:image/svg+xml;base64,' + btoa(`<?xml version="1.0"?><svg width="297" height="437" xmlns="http://www.w3.org/2000/svg"><g class="layer"><title>Layer 1</title><g id="svg_1" transform="matrix(1 0 0 1 0 0)"><g data-cell-id="1" id="svg_3"><g data-cell-id="8Pz4FwjKvFX1z93biRRz-4" id="svg_4"><g id="svg_5" transform="translate(0.5,0.5)"><ellipse cx="143" cy="153" fill="#000000" id="svg_6" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-5" id="svg_7"><g id="svg_8" transform="translate(0.5,0.5)"><ellipse cx="143" cy="233" fill="#ffff00" id="svg_9" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-6" id="svg_10"><g id="svg_11"><path d="m143,433l0,-160" fill="none" id="svg_12" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-8" id="svg_13"><g id="svg_14"><path d="m293,11.28l-130,101.72" fill="none" id="svg_15" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="8Pz4FwjKvFX1z93biRRz-9" id="svg_16"><g id="svg_17"><path d="m3,3l120,110l-10,-8.28" fill="none" id="svg_18" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" stroke-width="6"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--1" id="svg_19"><g id="svg_20" transform="translate(0.5,0.5)"><ellipse cx="143" cy="153" fill="#000000" id="svg_21" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--2" id="svg_22"><g id="svg_23" transform="translate(0.5,0.5)"><ellipse cx="143" cy="73" fill="#ff0000" id="svg_24" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g><g data-cell-id="ryJtjQtIMMNOp2CFgdi--3" id="svg_25"><g id="svg_26" transform="translate(0.5,0.5)"><ellipse cx="143" cy="233" fill="#000000" id="svg_27" rx="40" ry="40" stroke="rgb(0, 0, 0)" stroke-width="5"/></g></g></g></g></g></svg>`);
                distantImg.onload = () => { signalImages['distant'] = distantImg; };
                homeImg.onload = () => { signalImages['home'] = homeImg; };
                distantCautionImg.onload = () => { signalImages['distantCaution'] = distantCautionImg; };
                homeDangerImg.onload = () => { signalImages['homeDanger'] = homeDangerImg; };

                const signalLabelPlugin = {
                    afterDatasetsDraw(chart) {
                        const ctx = chart.ctx;
                        
                        // Draw common home signal marker at x=0
                        chart.data.datasets.forEach((dataset, datasetIndex) => {
                            if (dataset.isCommonHomeSignal && !dataset.hidden && dataset.data) {
                                dataset.data.forEach((datapoint, index) => {
                                    if (datapoint.isCommonHomeSignal) {
                                        const point = chart.getDatasetMeta(datasetIndex).data[index];
                                        if (point) {
                                            if (signalImages['homeDanger']) {
                                                ctx.drawImage(signalImages['homeDanger'], point.x - 16, point.y - 36, 30, 36);
                                            }
                                        }
                                    }
                                });
                            }
                        });
                        
                        chart.data.datasets.forEach((dataset, datasetIndex) => {
                            if (dataset.isSignalDataset && !dataset.hidden) {
                                dataset.data.forEach((datapoint, index) => {
                                    if (datapoint.label) {
                                        const point = chart.getDatasetMeta(datasetIndex).data[index];
                                        if (point) {
                                            const x = point.x;
                                            const y = point.y;
                                            const signalType = (datapoint.signalType || '').toLowerCase();
                                            
                                            // Handle Home Signal
                                            if (signalType.includes('home') && signalImages['home']) {
                                                ctx.drawImage(signalImages['home'], x - 6, y - 34, 30, 36);
                                            } else if (signalType.includes('home')) {
                                                ctx.fillStyle = '#FF0000';
                                                ctx.beginPath();
                                                ctx.arc(x, y, 8, 0, 2 * Math.PI);
                                                ctx.fill();
                                                ctx.fillStyle = '#FFFFFF';
                                                ctx.beginPath();
                                                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                                                ctx.fill();
                                            }
                                            
                                            // Handle Distant Signal (DS, LSSDS, GSDS, or IB Distant)
                                            if ((signalType.includes('distant') || signalType.includes('lss cum distant') || signalType.includes('gs cum distant') || signalType.includes('ib distant')) && signalImages['distantCaution']) {
                                                ctx.drawImage(signalImages['distantCaution'], x - 6, y - 32, 10, 30);
                                            }
                                            
                                            ctx.fillStyle = '#000000';
                                            ctx.font = 'bold 10px Arial';
                                            ctx.textAlign = 'center';
                                            ctx.fillText(datapoint.label, x, y - 38);
                                        }
                                    }
                                });
                            }
                        });
                    }
                };

                if (homeSignalsAnalysisChart) homeSignalsAnalysisChart.destroy();
                homeSignalsAnalysisChart = plotChart('homeSignalsAnalysisChart', { datasets }, options, [signalLabelPlugin]);

                // Create legend for Home signals chart
                const homeStoppageLegend = document.getElementById('home-stoppage-legend');
                if (homeStoppageLegend) {
                    homeStoppageLegend.innerHTML = '';
                    
                    // Add legend items for each home signal stop (main datasets)
                    stops.forEach((stop, idx) => {
                        const stopPoint = turf.point([allLocations[stop.endIndex].lon, allLocations[stop.endIndex].lat]);
                        
                        // Get the nearest signal to the stop point
                        const nextSignal = findNextSignalAfterStop(stopPoint);
                        
                        // Check if the nearest signal type is "home" or "IBS"
                        const signalTypeLower = nextSignal ? nextSignal.type.toLowerCase() : '';
                        const isHomeOrIBS = signalTypeLower.includes('home') || signalTypeLower.includes('ibs');
                        
                        // Only include stops where the nearest signal is Home or IBS
                        if (!isHomeOrIBS) return;

                        // Find corresponding dataset for this stop
                        let datasetIdx = -1;
                        for (let i = 0; i < homeSignalsAnalysisChart.data.datasets.length; i++) {
                            const ds = homeSignalsAnalysisChart.data.datasets[i];
                            if (ds.isHomeSignalStop && ds.stopIndex === idx) {
                                datasetIdx = i;
                                break;
                            }
                        }

                        if (datasetIdx === -1) return;

                        const dataset = homeSignalsAnalysisChart.data.datasets[datasetIdx];
                        const color = dataset.borderColor;
                        let signalText = '';
                        
                        if (nextSignal) {
                            signalText = `${nextSignal.station} (${nextSignal.type}) ${Math.round(nextSignal.distance)}m`;
                        }

                        const legendEl = document.createElement('span');
                        legendEl.className = 'legend-item inline-flex flex-col items-start m-1 px-2 py-0.5 rounded-full text-xs font-medium';
                        legendEl.style.backgroundColor = `${color}20`;
                        legendEl.style.color = color;
                        legendEl.innerHTML = `<div class="legend-item-content"><div class="legend-item-text">${signalText}<br>${formatTime(stop.time)}</div><span class="legend-item-delete" title="Click to delete this dataset">✕</span></div>`;
                        legendEl.dataset.datasetIndex = datasetIdx;
                        legendEl.title = `${signalText} - Stopped at ${formatTime(stop.time)}`;
                        homeStoppageLegend.appendChild(legendEl);
                    });

                    // Add legend handlers
                    homeStoppageLegend.querySelectorAll('.legend-item').forEach(item => {
                        // Handle left-click to toggle visibility
                        item.addEventListener('click', (e) => {
                            if (e.target.classList.contains('legend-item-delete')) {
                                e.stopPropagation();
                                return;
                            }

                            const clickedIndex = parseInt(item.dataset.datasetIndex);
                            const clickedDataset = homeSignalsAnalysisChart.data.datasets[clickedIndex];

                            clickedDataset.hidden = !clickedDataset.hidden;
                            item.classList.toggle('striked', clickedDataset.hidden);

                            // Also toggle signal markers for this specific stop
                            const stopIndex = clickedDataset.stopIndex;
                            homeSignalsAnalysisChart.data.datasets.forEach((dataset, idx) => {
                                if (dataset.isSignalDataset && dataset.stopIndex === stopIndex) {
                                    dataset.hidden = clickedDataset.hidden;
                                }
                            });

                            homeSignalsAnalysisChart.update();
                        });

                        // Handle delete button click
                        const deleteBtn = item.querySelector('.legend-item-delete');
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                
                                const datasetIndex = parseInt(item.dataset.datasetIndex);
                                const stopIndex = homeSignalsAnalysisChart.data.datasets[datasetIndex].stopIndex;

                                homeSignalsAnalysisChart.data.datasets.splice(datasetIndex, 1);

                                // Also remove any associated signal datasets for this stop
                                for (let i = homeSignalsAnalysisChart.data.datasets.length - 1; i >= 0; i--) {
                                    const ds = homeSignalsAnalysisChart.data.datasets[i];
                                    if (ds.isSignalDataset && ds.stopIndex === stopIndex) {
                                        homeSignalsAnalysisChart.data.datasets.splice(i, 1);
                                    }
                                }

                                item.remove();

                                // Update dataset indices for remaining legend items
                                homeStoppageLegend.querySelectorAll('.legend-item').forEach((legendItem, idx) => {
                                    let correctIndex = 0;
                                    for (let i = 0; i < homeSignalsAnalysisChart.data.datasets.length; i++) {
                                        if (!homeSignalsAnalysisChart.data.datasets[i].isSignalDataset && !homeSignalsAnalysisChart.data.datasets[i].isCommonHomeSignal) {
                                            if (correctIndex === idx) {
                                                legendItem.dataset.datasetIndex = i;
                                                break;
                                            }
                                            correctIndex++;
                                        }
                                    }
                                });

                                homeSignalsAnalysisChart.update();
                            });
                        }
                    });
                }
            }

        });
    </script>
