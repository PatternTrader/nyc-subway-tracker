class SubwayTracker {
    constructor() {
        this.refreshInterval = null;
        this.isLoading = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadArrivals();
        this.startAutoRefresh();
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refresh-btn');
        const autoRefreshCheckbox = document.getElementById('auto-refresh');

        refreshBtn.addEventListener('click', () => {
            this.loadArrivals();
        });

        autoRefreshCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => {
            this.loadArrivals();
        }, 60000); // Refresh every 60 seconds (1 minute)
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    async loadArrivals() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.updateStatus('Loading...', '');
        this.setRefreshButtonState(true);

        try {
            const response = await fetch('/api/arrivals');
            const data = await response.json();

            if (data.status === 'success') {
                this.displayArrivals(data);
                this.updateStatus('Live', data.last_updated);
            } else {
                this.displayError(data.message);
                this.updateStatus('Error', '');
            }
        } catch (error) {
            console.error('Error fetching arrivals:', error);
            this.displayError('Unable to connect to server. Please check your connection.');
            this.updateStatus('Connection Error', '');
        } finally {
            this.isLoading = false;
            this.setRefreshButtonState(false);
        }
    }

    displayArrivals(data) {
        const stationsContainer = document.getElementById('stations-container');
        
        if (!data.stations || Object.keys(data.stations).length === 0) {
            stationsContainer.innerHTML = `
                <div class="no-trains">
                    <p>No upcoming trains found.</p>
                    <p>Check back in a few minutes.</p>
                </div>
            `;
            return;
        }

        // Group stations by row and column with proper ordering
        const stationsByRow = {};
        const stationOrder = {
            // Row 1 order
            'q_86th': {row: 1, column: 1, order: 1},
            'union_square_rw': {row: 1, column: 2, order: 1}, 
            'whitehall_rw_downtown': {row: 1, column: 2, order: 2}, // Underneath union_square_rw
            'union_square_45': {row: 1, column: 3, order: 1},
            'bowling_green_45_downtown': {row: 1, column: 3, order: 2}, // Underneath union_square_45
            // Row 2 order - Whitehall uptown, Bowling Green, then Union Square Q
            'whitehall_rw': {row: 2, column: 1, order: 1},
            'bowling_green_45': {row: 2, column: 2, order: 1},
            '45_86th_uptown': {row: 2, column: 2, order: 2}, // Underneath bowling_green_45
            'union_square_q': {row: 2, column: 3, order: 1},
            'q_86th_uptown': {row: 2, column: 3, order: 2} // Underneath union_square_q
        };
        
        // Group stations by row-column structure
        const rowColumnStructure = {};
        
        Object.entries(data.stations).forEach(([stationKey, stationData]) => {
            const orderInfo = stationOrder[stationKey] || {row: 1, column: 1, order: 999};
            const row = orderInfo.row;
            const column = orderInfo.column;
            
            if (!rowColumnStructure[row]) {
                rowColumnStructure[row] = {};
            }
            if (!rowColumnStructure[row][column]) {
                rowColumnStructure[row][column] = [];
            }
            
            rowColumnStructure[row][column].push([stationKey, stationData, orderInfo.order]);
        });
        
        // Sort stations within each column by order
        Object.keys(rowColumnStructure).forEach(row => {
            Object.keys(rowColumnStructure[row]).forEach(column => {
                rowColumnStructure[row][column].sort((a, b) => a[2] - b[2]);
            });
        });

        // Create HTML for each row
        const rowsHtml = Object.keys(rowColumnStructure).sort().map(row => {
            const columnsHtml = Object.keys(rowColumnStructure[row]).sort().map(column => {
                const columnStations = rowColumnStructure[row][column];
                const stationsHtml = columnStations.map(([stationKey, stationData]) => {
                const station = stationData.station;
                const arrivals = stationData.arrivals;
                
                // Create train icons for routes
                const trainIcons = station.routes.map(route => {
                    const routeClass = route === '4' || route === '5' ? `route-${route}` : route.toLowerCase();
                    return `<div class="train-icon ${routeClass}">${route}</div>`;
                }).join('');
                
                // Special filtering for downtown R/W and 4/5 Union Square on page load
                let displayArrivals;
                if (stationKey === 'union_square_rw' || stationKey === 'union_square_45' || stationKey === 'bowling_green_45_downtown') {
                    // Filter out trains arriving in 10 minutes or less, then take up to 5
                    const filteredArrivals = arrivals.filter(arrival => arrival.minutes > 10);
                    displayArrivals = filteredArrivals.slice(0, 5);
                    
                    // If we don't have 5 trains after filtering, take more from the original list
                    if (displayArrivals.length < 5) {
                        const additionalArrivals = arrivals.filter(arrival => arrival.minutes <= 10);
                        const needed = 5 - displayArrivals.length;
                        displayArrivals = [...displayArrivals, ...additionalArrivals.slice(0, needed)];
                    }
                } else {
                    // For all other stations, show first 5 trains
                    displayArrivals = arrivals.slice(0, 5);
                }
                
                const arrivalsHtml = displayArrivals.length > 0 ? 
                    displayArrivals.map(arrival => {
                        const minutesClass = this.getMinutesClass(arrival.minutes);
                        const minutesText = arrival.minutes === 0 ? 'Now' : `${arrival.minutes} min`;
                        
                        const routeBadgeClass = arrival.route === '4' || arrival.route === '5' ? `route-${arrival.route}` : arrival.route.toLowerCase();
                        
                        // Make 86th Street Q train times clickable
                        const isClickable = stationKey === 'q_86th' && arrival.route === 'Q';
                        const clickableClass = isClickable ? 'clickable-time' : '';
                        const dataAttrs = isClickable ? `data-departure-time="${arrival.timestamp}" data-departure-minutes="${arrival.minutes}"` : '';
                        
                        return `
                            <div class="arrival-item ${clickableClass}" ${dataAttrs} data-timestamp="${arrival.timestamp}">
                                <div class="arrival-route">
                                    <span class="route-badge ${routeBadgeClass}">${arrival.route}</span>
                                </div>
                                <div class="arrival-time">${arrival.time}</div>
                                <div class="arrival-minutes ${minutesClass}">${minutesText}</div>
                            </div>
                        `;
                    }).join('') : 
                    `<div class="no-trains">No upcoming trains</div>`;
                
                    return `
                        <div class="station-section" data-station="${stationKey}">
                            <div class="station-header">
                                <div class="station-icons">${trainIcons}</div>
                                <div class="station-info">
                                    <h2>${station.name}</h2>
                                    <p>${station.area} • ${station.direction}</p>
                                </div>
                            </div>
                            <div class="arrivals-list">
                                ${arrivalsHtml}
                            </div>
                            ${stationKey === 'q_86th' ? '<div id="union-square-arrival" class="union-square-arrival"></div>' : ''}
                            ${stationKey === 'union_square_rw' ? '<div id="rw-platform-note" class="platform-note" style="display: none;"></div>' : ''}
                            ${stationKey === 'union_square_45' ? '<div id="45-platform-note" class="platform-note" style="display: none;"></div>' : ''}
                        </div>
                    `;
                }).join('');
                
                return `<div class="station-column">${stationsHtml}</div>`;
            }).join('');

            return `<div class="stations-row">${columnsHtml}</div>`;
        }).join('');

        stationsContainer.innerHTML = rowsHtml;
        
        // Apply downstream filtering on page load
        this.applyInitialDownstreamFiltering();
        
        // Show default Union Square arrival info for 86th Street
        this.showDefaultUnionSquareArrival();
        
        // Show default Whitehall arrival info for downtown R/W Union Square
        this.showDefaultWhitehallArrival();
        
        // Show default Bowling Green arrival info for downtown 4/5 Union Square
        this.showDefaultBowlingGreenArrival();
        
        // Filter Union Square boxes to show only viable times on page load
        this.filterUnionSquareOnPageLoad();
        
        // Add click event listeners to 86th Street Q train times
        this.addClickListeners();
    }
    
    filterUnionSquareOnPageLoad() {
        // Filter downtown Union Square boxes to show only viable times based on 86th Street Q arrival
        const firstQTrain = document.querySelector('[data-station="q_86th"] .arrival-item');
        if (firstQTrain) {
            const departureTime = parseInt(firstQTrain.dataset.timestamp);
            if (departureTime) {
                const travelTimeMinutes = 14;
                const unionSquareArrivalTimestamp = departureTime + (travelTimeMinutes * 60);
                
                // Filter both Union Square boxes with 0-minute transfer time (immediate connections)
                this.filterAndShowNext5Trains('[data-station="union_square_rw"]', unionSquareArrivalTimestamp);
                this.filterAndShowNext5Trains('[data-station="union_square_45"]', unionSquareArrivalTimestamp);
                
                // Update arrival displays to reflect the new filtered earliest trains
                this.showDefaultWhitehallArrival();
                this.showDefaultBowlingGreenArrival();
            }
        }
    }
    
    showDefaultUnionSquareArrival() {
        // Show arrival info for the first (earliest) Q train at 86th Street
        const firstQTrain = document.querySelector('[data-station="q_86th"] .arrival-item');
        if (firstQTrain) {
            const departureTime = parseInt(firstQTrain.dataset.timestamp);
            const departureMinutes = parseInt(firstQTrain.dataset.timestamp) 
                ? Math.round((parseInt(firstQTrain.dataset.timestamp) - Date.now() / 1000) / 60) 
                : 0;
            
            if (departureTime && departureMinutes >= 0) {
                const travelTimeMinutes = 14;
                const unionSquareArrivalTimestamp = departureTime + (travelTimeMinutes * 60);
                const unionSquareArrivalTime = new Date(unionSquareArrivalTimestamp * 1000).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: false 
                });
                const totalMinutesFromNow = departureMinutes + travelTimeMinutes;
                
                this.displayUnionSquareArrival(unionSquareArrivalTime, totalMinutesFromNow, travelTimeMinutes);
            }
        }
    }
    
    showDefaultWhitehallArrival() {
        // Show arrival info for the first visible (earliest) R/W train at downtown Union Square
        const rwTrains = document.querySelectorAll('[data-station="union_square_rw"] .arrival-item');
        let firstVisibleRWTrain = null;
        
        // Find the first visible train (not hidden by filtering)
        for (let train of rwTrains) {
            if (train.style.display !== 'none') {
                firstVisibleRWTrain = train;
                break;
            }
        }
        
        if (firstVisibleRWTrain) {
            const departureTime = parseInt(firstVisibleRWTrain.dataset.timestamp);
            const departureMinutes = Math.round((departureTime - Date.now() / 1000) / 60);
            
            if (departureTime && departureMinutes >= 0) {
                const travelTimeMinutes = 9;
                const whitehallArrivalTimestamp = departureTime + (travelTimeMinutes * 60);
                const whitehallArrivalTime = new Date(whitehallArrivalTimestamp * 1000).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: false 
                });
                const totalMinutesFromNow = departureMinutes + travelTimeMinutes;
                
                this.displayWhitehallArrival(whitehallArrivalTime, totalMinutesFromNow, travelTimeMinutes);
            }
        }
    }
    
    displayWhitehallArrival(arrivalTime, totalMinutes, travelTime) {
        const rwStationSection = document.querySelector('[data-station="union_square_rw"]');
        if (rwStationSection) {
            // Check if whitehall arrival display already exists
            let arrivalDisplay = rwStationSection.querySelector('.whitehall-arrival');
            if (!arrivalDisplay) {
                arrivalDisplay = document.createElement('div');
                arrivalDisplay.className = 'whitehall-arrival union-square-arrival';
                arrivalDisplay.id = 'whitehall-arrival';
                rwStationSection.querySelector('.arrivals-list').after(arrivalDisplay);
            }
            
            arrivalDisplay.innerHTML = `
                <div class="arrival-calculation">
                    <div class="calculation-header">
                        <span class="route-badge r" style="background: #fccc0a; color: black;">R/W</span>
                        <span class="destination">→ Whitehall</span>
                    </div>
                    <div class="calculation-details">
                        <div class="arrival-info">
                            <strong>Arrive at Whitehall: ${arrivalTime}</strong>
                        </div>
                        <div class="travel-info">
                            <small>In ${totalMinutes} min (${travelTime} min travel time)</small>
                        </div>
                    </div>
                </div>
            `;
            arrivalDisplay.style.display = 'block';
        }
    }
    
    showDefaultBowlingGreenArrival() {
        // Show arrival info for the first (earliest) 4/5 train at downtown Union Square
        const first45Train = document.querySelector('[data-station="union_square_45"] .arrival-item');
        if (first45Train) {
            const departureTime = parseInt(first45Train.dataset.timestamp);
            const departureMinutes = parseInt(first45Train.dataset.timestamp) 
                ? Math.round((parseInt(first45Train.dataset.timestamp) - Date.now() / 1000) / 60) 
                : 0;
            
            if (departureTime && departureMinutes >= 0) {
                const travelTimeMinutes = 9;
                const bowlingGreenArrivalTimestamp = departureTime + (travelTimeMinutes * 60);
                const bowlingGreenArrivalTime = new Date(bowlingGreenArrivalTimestamp * 1000).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: false 
                });
                const totalMinutesFromNow = departureMinutes + travelTimeMinutes;
                
                this.displayBowlingGreenArrival(bowlingGreenArrivalTime, totalMinutesFromNow, travelTimeMinutes);
            }
        }
    }
    
    displayBowlingGreenArrival(arrivalTime, totalMinutes, travelTime) {
        const train45StationSection = document.querySelector('[data-station="union_square_45"]');
        if (train45StationSection) {
            // Check if bowling green arrival display already exists
            let arrivalDisplay = train45StationSection.querySelector('.bowling-green-arrival');
            if (!arrivalDisplay) {
                arrivalDisplay = document.createElement('div');
                arrivalDisplay.className = 'bowling-green-arrival union-square-arrival';
                arrivalDisplay.id = 'bowling-green-arrival';
                train45StationSection.querySelector('.arrivals-list').after(arrivalDisplay);
            }
            
            arrivalDisplay.innerHTML = `
                <div class="arrival-calculation">
                    <div class="calculation-header">
                        <span class="route-badge route-4" style="background: #00933c; color: white;">4/5</span>
                        <span class="destination">→ Bowling Green</span>
                    </div>
                    <div class="calculation-details">
                        <div class="arrival-info">
                            <strong>Arrive at Bowling Green: ${arrivalTime}</strong>
                        </div>
                        <div class="travel-info">
                            <small>In ${totalMinutes} min (${travelTime} min travel time)</small>
                        </div>
                    </div>
                </div>
            `;
            arrivalDisplay.style.display = 'block';
        }
    }
    
    applyInitialDownstreamFiltering() {
        // Filter downstream boxes on page load based on their upstream Union Square boxes
        this.filterWhitehallConnections();
        this.filterBowlingGreenConnections();
        
        // Filter uptown Union Square Q box based on uptown feeder stations
        this.filterUptownUnionSquareConnections();
        
        // Filter uptown 86th Street Q box based on uptown Union Square Q
        this.filterUptown86thConnections();
        
        // Filter uptown 4/5 86th Street box based on uptown Bowling Green 4/5
        this.filterUptown45_86thConnections();
        
        // Update downstream boxes to show only viable times
        this.updateDownstreamViability();
    }
    
    updateDownstreamViability() {
        // Update downstream boxes to show only viable times based on filtered Union Square trains
        
        // Find earliest visible R/W train at Union Square
        const rwTrains = document.querySelectorAll('[data-station="union_square_rw"] .arrival-item');
        let earliestRWTrain = null;
        for (let train of rwTrains) {
            if (train.style.display !== 'none') {
                earliestRWTrain = train;
                break;
            }
        }
        
        if (earliestRWTrain) {
            const departureTime = parseInt(earliestRWTrain.dataset.timestamp);
            const travelTime = 9 * 60; // 9 minutes in seconds
            const whitehallArrivalTime = departureTime + travelTime;
            this.filterAndShowNext5Trains('[data-station="whitehall_rw_downtown"]', whitehallArrivalTime);
        }
        
        // Find earliest visible 4/5 train at Union Square
        const train45s = document.querySelectorAll('[data-station="union_square_45"] .arrival-item');
        let earliest45Train = null;
        for (let train of train45s) {
            if (train.style.display !== 'none') {
                earliest45Train = train;
                break;
            }
        }
        
        if (earliest45Train) {
            const departureTime = parseInt(earliest45Train.dataset.timestamp);
            const travelTime = 9 * 60; // 9 minutes in seconds
            const bowlingGreenArrivalTime = departureTime + travelTime;
            this.filterAndShowNext5Trains('[data-station="bowling_green_45_downtown"]', bowlingGreenArrivalTime);
        }
    }
    
    addClickListeners() {
        const clickableTimes = document.querySelectorAll('.clickable-time');
        clickableTimes.forEach(item => {
            item.addEventListener('click', (e) => {
                const departureTime = parseInt(e.currentTarget.dataset.departureTime);
                const departureMinutes = parseInt(e.currentTarget.dataset.departureMinutes);
                this.calculateUnionSquareArrival(departureTime, departureMinutes, e.currentTarget);
            });
        });
    }
    
    calculateUnionSquareArrival(departureTimestamp, departureMinutes, selectedElement) {
        // Check if clicking on already selected train (toggle off)
        if (selectedElement.classList.contains('selected-departure')) {
            // Deselect the train and clear all highlights
            this.clearConnectionHighlights();
            this.clearSelectedHighlight();
            
            // Restore default arrival displays
            this.showDefaultUnionSquareArrival();
            this.showDefaultWhitehallArrival();
            this.showDefaultBowlingGreenArrival();
            
            // Hide platform notes
            const rwPlatformNote = document.getElementById('rw-platform-note');
            const platformNote45 = document.getElementById('45-platform-note');
            if (rwPlatformNote) rwPlatformNote.style.display = 'none';
            if (platformNote45) platformNote45.style.display = 'none';
            
            return; // Exit early - no further processing
        }
        
        // Clear any existing highlights
        this.clearConnectionHighlights();
        this.clearSelectedHighlight();
        
        // Highlight the selected 86th Street time
        selectedElement.classList.add('selected-departure');
        
        // Q train travel time from 86th Street to Union Square is approximately 14 minutes
        const travelTimeMinutes = 14;
        
        const unionSquareArrivalTimestamp = departureTimestamp + (travelTimeMinutes * 60);
        const unionSquareArrivalTime = new Date(unionSquareArrivalTimestamp * 1000).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        });
        
        const totalMinutesFromNow = departureMinutes + travelTimeMinutes;
        
        this.displayUnionSquareArrival(unionSquareArrivalTime, totalMinutesFromNow, travelTimeMinutes);
        this.highlightConnections(unionSquareArrivalTimestamp);
        this.filterUnionSquareConnections(unionSquareArrivalTimestamp);
        this.filterWhitehallConnections();
        this.filterBowlingGreenConnections();
        this.updateBowlingGreenArrival();
        this.showPlatformNotes(unionSquareArrivalTimestamp);
    }
    
    updateBowlingGreenArrival() {
        // Find the first visible (earliest) 4/5 train in downtown Union Square after filtering
        const visible45Trains = document.querySelectorAll('[data-station="union_square_45"] .arrival-item');
        let earliest45Train = null;
        
        for (let train of visible45Trains) {
            if (train.style.display !== 'none') {
                earliest45Train = train;
                break;
            }
        }
        
        if (earliest45Train) {
            const departureTime = parseInt(earliest45Train.dataset.timestamp);
            const departureMinutes = Math.round((departureTime - Date.now() / 1000) / 60);
            
            if (departureTime && departureMinutes >= 0) {
                const travelTimeMinutes = 9;
                const bowlingGreenArrivalTimestamp = departureTime + (travelTimeMinutes * 60);
                const bowlingGreenArrivalTime = new Date(bowlingGreenArrivalTimestamp * 1000).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: false 
                });
                const totalMinutesFromNow = departureMinutes + travelTimeMinutes;
                
                this.displayBowlingGreenArrival(bowlingGreenArrivalTime, totalMinutesFromNow, travelTimeMinutes);
            }
        }
    }
    
    displayUnionSquareArrival(arrivalTime, totalMinutes, travelTime) {
        const arrivalDisplay = document.getElementById('union-square-arrival');
        if (arrivalDisplay) {
            arrivalDisplay.innerHTML = `
                <div class="arrival-calculation">
                    <div class="calculation-header">
                        <span class="route-badge q">Q</span>
                        <span class="destination">→ Union Square</span>
                    </div>
                    <div class="calculation-details">
                        <div class="arrival-info">
                            <strong>Arrive at Union Square: ${arrivalTime}</strong>
                        </div>
                        <div class="travel-info">
                            <small>In ${totalMinutes} min (${travelTime} min travel time)</small>
                        </div>
                    </div>
                </div>
            `;
            arrivalDisplay.style.display = 'block';
        }
    }
    
    highlightConnections(arrivalTimestamp) {
        // No transfer time - immediate connections
        const transferTimeMinutes = 0;
        const earliestConnectionTime = arrivalTimestamp + (transferTimeMinutes * 60);
        
        // Find Union Square R/W station arrivals
        const unionSquareRWArrivals = document.querySelectorAll('[data-station="union_square_rw"] .arrival-item');
        unionSquareRWArrivals.forEach(item => {
            const arrivalTime = parseInt(item.dataset.timestamp);
            if (arrivalTime && arrivalTime >= earliestConnectionTime) {
                item.classList.add('connection-highlight');
            }
        });
        
        // Find Union Square 4/5 station arrivals
        const unionSquare45Arrivals = document.querySelectorAll('[data-station="union_square_45"] .arrival-item');
        unionSquare45Arrivals.forEach(item => {
            const arrivalTime = parseInt(item.dataset.timestamp);
            if (arrivalTime && arrivalTime >= earliestConnectionTime) {
                item.classList.add('connection-highlight');
            }
        });
    }
    
    clearConnectionHighlights() {
        const highlights = document.querySelectorAll('.connection-highlight');
        highlights.forEach(item => {
            item.classList.remove('connection-highlight');
        });
        
        // Restore first 5 trains when clearing selection
        this.restoreFirst5Trains('[data-station="union_square_rw"]');
        this.restoreFirst5Trains('[data-station="union_square_45"]');
        this.restoreFirst5Trains('[data-station="whitehall_rw_downtown"]');
        this.restoreFirst5Trains('[data-station="bowling_green_45_downtown"]');
    }
    
    restoreFirst5Trains(stationSelector) {
        const arrivals = document.querySelectorAll(`${stationSelector} .arrival-item:not(.no-data-placeholder)`);
        const stationContainer = document.querySelector(`${stationSelector}`);
        
        // Remove any existing placeholders
        if (stationContainer) {
            const existingPlaceholders = stationContainer.querySelectorAll('.no-data-placeholder');
            existingPlaceholders.forEach(placeholder => placeholder.remove());
        }
        
        // Hide all trains first
        arrivals.forEach(item => {
            item.style.display = 'none';
        });
        
        // Show only the first 5 trains
        Array.from(arrivals).slice(0, 5).forEach(item => {
            item.style.display = 'grid';
        });
    }
    
    clearSelectedHighlight() {
        const selectedItems = document.querySelectorAll('.selected-departure');
        selectedItems.forEach(item => {
            item.classList.remove('selected-departure');
        });
    }
    
    showPlatformNotes(unionSquareArrivalTimestamp) {
        // Show R/W platform note
        const rwPlatformNote = document.getElementById('rw-platform-note');
        if (rwPlatformNote) {
            rwPlatformNote.innerHTML = `
                <div class="platform-info">
                    <div class="platform-icon">🚇</div>
                    <div class="platform-text">
                        <strong>Platform Info:</strong> R/W is on the same platform across from the Q
                    </div>
                </div>
            `;
            rwPlatformNote.style.display = 'block';
        }
        
        // Show 4/5 platform note
        const platformNote45 = document.getElementById('45-platform-note');
        if (platformNote45) {
            platformNote45.innerHTML = `
                <div class="platform-info">
                    <div class="platform-icon">🚇</div>
                    <div class="platform-text">
                        <strong>Platform Info:</strong> Go to the front of the Q train. Transfer time to 4/5 is 0 mins.
                    </div>
                </div>
            `;
            platformNote45.style.display = 'block';
        }
    }
    
    calculateWhitehallArrival(unionSquareArrivalTimestamp) {
        // Find the first highlighted green R/W train (connection-highlight class)
        const highlightedRWTrains = document.querySelectorAll('[data-station="union_square_rw"] .arrival-item.connection-highlight');
        
        if (highlightedRWTrains.length === 0) return null;
        
        // Get the first highlighted train's departure time
        const firstHighlightedTrain = highlightedRWTrains[0];
        const rwDepartureTime = parseInt(firstHighlightedTrain.dataset.timestamp);
        
        if (!rwDepartureTime) return null;
        
        // R/W travel time from Union Square to Whitehall is approximately 3-4 minutes
        const travelTimeToWhitehall = 4;
        const whitehallArrivalTimestamp = rwDepartureTime + (travelTimeToWhitehall * 60);
        
        const whitehallArrivalTime = new Date(whitehallArrivalTimestamp * 1000).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        });
        
        const totalMinutesFromNow = Math.round((whitehallArrivalTimestamp - Date.now() / 1000) / 60);
        
        return {
            time: whitehallArrivalTime,
            totalMinutes: totalMinutesFromNow
        };
    }
    
    calculateBowlingGreenArrival(unionSquareArrivalTimestamp) {
        // Find the first highlighted green 4/5 train (connection-highlight class)
        const highlighted45Trains = document.querySelectorAll('[data-station="union_square_45"] .arrival-item.connection-highlight');
        
        if (highlighted45Trains.length === 0) return null;
        
        // Get the first highlighted train's departure time
        const firstHighlightedTrain = highlighted45Trains[0];
        const train45DepartureTime = parseInt(firstHighlightedTrain.dataset.timestamp);
        
        if (!train45DepartureTime) return null;
        
        // 4/5 travel time from Union Square to Bowling Green is approximately 5-6 minutes
        const travelTimeToBowlingGreen = 6;
        const bowlingGreenArrivalTimestamp = train45DepartureTime + (travelTimeToBowlingGreen * 60);
        
        const bowlingGreenArrivalTime = new Date(bowlingGreenArrivalTimestamp * 1000).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        });
        
        const totalMinutesFromNow = Math.round((bowlingGreenArrivalTimestamp - Date.now() / 1000) / 60);
        
        return {
            time: bowlingGreenArrivalTime,
            totalMinutes: totalMinutesFromNow
        };
    }
    
    filterUnionSquareConnections(unionSquareArrivalTimestamp) {
        // No transfer time - immediate connections
        const transferTimeMinutes = 0;
        const earliestConnectionTime = unionSquareArrivalTimestamp + (transferTimeMinutes * 60);
        
        this.filterAndShowNext5Trains('[data-station="union_square_rw"]', earliestConnectionTime);
        this.filterAndShowNext5Trains('[data-station="union_square_45"]', earliestConnectionTime);
    }
    
    filterWhitehallConnections() {
        // Find the earliest time shown in downtown R/W Union Square box
        const rwArrivals = document.querySelectorAll('[data-station="union_square_rw"] .arrival-item');
        
        if (rwArrivals.length === 0) {
            // No trains visible, restore all Whitehall trains
            this.restoreFirst5Trains('[data-station="whitehall_rw_downtown"]');
            return;
        }
        
        // Find the earliest visible train (first one that's not hidden)
        let earliestVisibleTrain = null;
        for (let train of rwArrivals) {
            if (train.style.display !== 'none') {
                earliestVisibleTrain = train;
                break;
            }
        }
        
        if (!earliestVisibleTrain) {
            this.restoreFirst5Trains('[data-station="whitehall_rw_downtown"]');
            return;
        }
        
        const earliestDepartureTime = parseInt(earliestVisibleTrain.dataset.timestamp);
        
        if (!earliestDepartureTime) {
            this.restoreFirst5Trains('[data-station="whitehall_rw_downtown"]');
            return;
        }
        
        // Add 9 minutes travel time from Union Square to Whitehall
        const travelTimeMinutes = 9;
        const minimumWhitehallTime = earliestDepartureTime + (travelTimeMinutes * 60);
        
        // Filter Whitehall trains to only show those departing AFTER the earliest R/W time + 9 minutes travel time
        this.filterAndShowNext5Trains('[data-station="whitehall_rw_downtown"]', minimumWhitehallTime);
    }
    
    filterBowlingGreenConnections() {
        // Find the earliest time shown in downtown 4/5 Union Square box
        const train45Arrivals = document.querySelectorAll('[data-station="union_square_45"] .arrival-item');
        
        if (train45Arrivals.length === 0) {
            // No trains visible, restore all Bowling Green trains
            this.restoreFirst5Trains('[data-station="bowling_green_45_downtown"]');
            return;
        }
        
        // Find the earliest visible train (first one that's not hidden)
        let earliestVisibleTrain = null;
        for (let train of train45Arrivals) {
            if (train.style.display !== 'none') {
                earliestVisibleTrain = train;
                break;
            }
        }
        
        if (!earliestVisibleTrain) {
            this.restoreFirst5Trains('[data-station="bowling_green_45_downtown"]');
            return;
        }
        
        const earliestDepartureTime = parseInt(earliestVisibleTrain.dataset.timestamp);
        
        if (!earliestDepartureTime) {
            this.restoreFirst5Trains('[data-station="bowling_green_45_downtown"]');
            return;
        }
        
        // Add 9 minutes travel time from Union Square to Bowling Green
        const travelTimeMinutes = 9;
        const minimumBowlingGreenTime = earliestDepartureTime + (travelTimeMinutes * 60);
        
        // Filter Bowling Green trains to only show those departing AFTER the earliest 4/5 time + 9 minutes travel time
        this.filterAndShowNext5Trains('[data-station="bowling_green_45_downtown"]', minimumBowlingGreenTime);
    }
    
    filterUptownUnionSquareConnections() {
        // Find earliest times in both uptown feeder stations
        const whitehallRWArrivals = document.querySelectorAll('[data-station="whitehall_rw"] .arrival-item');
        const bowlingGreen45Arrivals = document.querySelectorAll('[data-station="bowling_green_45"] .arrival-item');
        
        let earliestWhitehallTime = null;
        let earliestBowlingGreenTime = null;
        
        // Get earliest visible time from uptown Whitehall R/W
        for (let train of whitehallRWArrivals) {
            if (train.style.display !== 'none') {
                earliestWhitehallTime = parseInt(train.dataset.timestamp);
                break;
            }
        }
        
        // Get earliest visible time from uptown Bowling Green 4/5
        for (let train of bowlingGreen45Arrivals) {
            if (train.style.display !== 'none') {
                earliestBowlingGreenTime = parseInt(train.dataset.timestamp);
                break;
            }
        }
        
        // Use the later of the two earliest times (so Q trains come after both)
        let minimumDepartureTime = null;
        if (earliestWhitehallTime && earliestBowlingGreenTime) {
            minimumDepartureTime = Math.max(earliestWhitehallTime, earliestBowlingGreenTime);
        } else if (earliestWhitehallTime) {
            minimumDepartureTime = earliestWhitehallTime;
        } else if (earliestBowlingGreenTime) {
            minimumDepartureTime = earliestBowlingGreenTime;
        }
        
        if (minimumDepartureTime) {
            // Filter uptown Union Square Q to show only trains after both feeder stations
            this.filterAndShowNext5Trains('[data-station="union_square_q"]', minimumDepartureTime);
        } else {
            // No constraints, restore normal display
            this.restoreFirst5Trains('[data-station="union_square_q"]');
        }
    }
    
    filterUptown86thConnections() {
        // Find the earliest time shown in uptown Union Square Q box
        const unionSquareQArrivals = document.querySelectorAll('[data-station="union_square_q"] .arrival-item');
        
        if (unionSquareQArrivals.length === 0) {
            // No trains visible, restore all uptown 86th trains
            this.restoreFirst5Trains('[data-station="q_86th_uptown"]');
            return;
        }
        
        // Find the earliest visible train (first one that's not hidden)
        let earliestVisibleTrain = null;
        for (let train of unionSquareQArrivals) {
            if (train.style.display !== 'none') {
                earliestVisibleTrain = train;
                break;
            }
        }
        
        if (!earliestVisibleTrain) {
            this.restoreFirst5Trains('[data-station="q_86th_uptown"]');
            return;
        }
        
        const earliestDepartureTime = parseInt(earliestVisibleTrain.dataset.timestamp);
        
        if (!earliestDepartureTime) {
            this.restoreFirst5Trains('[data-station="q_86th_uptown"]');
            return;
        }
        
        // Add 15 minutes travel time from Union Square to 86th Street
        const travelTimeMinutes = 15;
        const minimumArrivalTime = earliestDepartureTime + (travelTimeMinutes * 60);
        
        // Filter uptown 86th Street Q trains to only show those departing AFTER the earliest Union Square Q time + 15 minutes
        this.filterAndShowNext5Trains('[data-station="q_86th_uptown"]', minimumArrivalTime);
    }
    
    filterUptown45_86thConnections() {
        // Find the earliest time shown in uptown Bowling Green 4/5 box
        const bowlingGreen45Arrivals = document.querySelectorAll('[data-station="bowling_green_45"] .arrival-item');
        
        if (bowlingGreen45Arrivals.length === 0) {
            // No trains visible, restore all uptown 4/5 86th trains
            this.restoreFirst5Trains('[data-station="45_86th_uptown"]');
            return;
        }
        
        // Find the earliest visible train (first one that's not hidden)
        let earliestVisibleTrain = null;
        for (let train of bowlingGreen45Arrivals) {
            if (train.style.display !== 'none') {
                earliestVisibleTrain = train;
                break;
            }
        }
        
        if (!earliestVisibleTrain) {
            this.restoreFirst5Trains('[data-station="45_86th_uptown"]');
            return;
        }
        
        const earliestDepartureTime = parseInt(earliestVisibleTrain.dataset.timestamp);
        
        if (!earliestDepartureTime) {
            this.restoreFirst5Trains('[data-station="45_86th_uptown"]');
            return;
        }
        
        // Add 15 minutes travel time from Bowling Green to 86th Street
        const travelTimeMinutes = 15;
        const minimumArrivalTime = earliestDepartureTime + (travelTimeMinutes * 60);
        
        // Filter uptown 4/5 86th Street trains to only show those departing AFTER the earliest Bowling Green 4/5 time + 15 minutes
        this.filterAndShowNext5Trains('[data-station="45_86th_uptown"]', minimumArrivalTime);
    }
    
    filterAndShowNext5Trains(stationSelector, earliestConnectionTime) {
        const arrivals = document.querySelectorAll(`${stationSelector} .arrival-item`);
        const validArrivals = [];
        const allArrivals = [];
        
        // Collect all arrivals and find viable ones
        arrivals.forEach(item => {
            const arrivalTime = parseInt(item.dataset.timestamp);
            allArrivals.push(item);
            if (arrivalTime && arrivalTime >= earliestConnectionTime) {
                validArrivals.push(item);
            }
        });
        
        // Hide all trains first
        arrivals.forEach(item => {
            item.style.display = 'none';
        });
        
        // Show only viable trains, add placeholders if needed
        const viableTrains = validArrivals.slice(0, 5);
        const stationContainer = arrivals[0]?.closest('.station-section');
        
        // Show viable trains
        viableTrains.forEach(item => {
            item.style.display = 'grid';
        });
        
        // Add placeholders if we have fewer than 5 viable trains
        if (viableTrains.length < 5 && stationContainer) {
            const arrivalsListContainer = stationContainer.querySelector('.arrivals-list');
            const placeholdersNeeded = 5 - viableTrains.length;
            
            // Remove any existing placeholders first
            const existingPlaceholders = arrivalsListContainer.querySelectorAll('.no-data-placeholder');
            existingPlaceholders.forEach(placeholder => placeholder.remove());
            
            // Add new placeholders
            for (let i = 0; i < placeholdersNeeded; i++) {
                const placeholder = document.createElement('div');
                placeholder.className = 'arrival-item no-data-placeholder';
                placeholder.innerHTML = `
                    <div class="arrival-route">
                        <span class="route-badge" style="background: #666; color: #ccc;">—</span>
                    </div>
                    <div class="arrival-time" style="color: #666;">No data</div>
                    <div class="arrival-minutes" style="color: #666;">—</div>
                `;
                arrivalsListContainer.appendChild(placeholder);
            }
        }
    }

    displayError(message) {
        const stationsContainer = document.getElementById('stations-container');
        stationsContainer.innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${message}
            </div>
        `;
    }

    getMinutesClass(minutes) {
        if (minutes <= 2) return 'soon';
        if (minutes <= 10) return 'coming';
        return 'later';
    }

    updateStatus(status, lastUpdated) {
        document.getElementById('status').textContent = status;
        document.getElementById('last-updated').textContent = 
            lastUpdated ? `Updated: ${lastUpdated}` : '';
    }

    setRefreshButtonState(disabled) {
        const refreshBtn = document.getElementById('refresh-btn');
        refreshBtn.disabled = disabled;
        refreshBtn.textContent = disabled ? 'Loading...' : 'Refresh';
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SubwayTracker();
});