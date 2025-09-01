# NYC Subway Train Tracker

A comprehensive real-time NYC subway train arrival tracker showing Q, R/W, and 4/5 trains at key Manhattan stations with intelligent journey planning.

## Features

- **Real-time data** from MTA GTFS feeds for multiple lines
- **Interactive journey planning** - click Q train times to see viable connections
- **Smart filtering** - shows only catchable trains with realistic transfer times
- **10-station coverage** - Downtown and uptown directions
- **Responsive design** - works on desktop and mobile
- **Auto-refresh** - updates every minute with manual refresh option

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the Flask application:
```bash
python app.py
```

3. Open your browser and navigate to:
```
http://localhost:5000
```

## Usage

- The page automatically loads and displays current Q train arrivals
- Click "Refresh" to manually update arrival times
- Toggle auto-refresh on/off as needed
- Arrival times are color-coded:
  - Red: Arriving in 2 minutes or less
  - Yellow: Arriving in 3-10 minutes
  - Blue: Arriving in more than 10 minutes

## Technical Details

- **Backend**: Python Flask application that fetches GTFS-Realtime data from MTA
- **Station**: Q05S (86th Street, Southbound/Downtown)
- **Route**: Q Train only
- **Data Source**: MTA GTFS-Realtime feed for NQRW lines
- **Auto-refresh**: Every 30 seconds when enabled

## Files

- `app.py` - Flask backend server
- `index.html` - Main web interface
- `styles.css` - Subway-themed styling
- `script.js` - Frontend JavaScript for real-time updates
- `requirements.txt` - Python dependencies