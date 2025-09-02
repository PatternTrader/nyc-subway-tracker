from flask import Flask, jsonify, send_from_directory, send_file
from flask_cors import CORS
import requests
import datetime
import os
import pytz
from google.transit import gtfs_realtime_pb2

app = Flask(__name__)
CORS(app)

# Feed URLs for different lines
FEEDS = {
    'nqrw': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
    '456': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs"
}

# Station configurations
STATIONS = {
    'q_86th': {
        'station_id': 'Q05S',  # 86 St, Southbound (downtown)
        'routes': ['Q'],
        'name': '86th Street',
        'direction': 'Downtown',
        'area': 'Upper East Side',
        'feed': 'nqrw',
        'row': 1
    },
    'union_square_rw': {
        'station_id': 'R20S',  # Union Square, Southbound (downtown)
        'routes': ['R', 'W'],
        'name': 'Union Square',
        'direction': 'Downtown', 
        'area': 'R/W Lines',
        'feed': 'nqrw',
        'row': 1,
        'column': 2
    },
    'union_square_45': {
        'station_id': '621S',  # Union Square, Southbound (downtown) - 4/5/6 system uses different IDs  
        'routes': ['4', '5'],
        'name': 'Union Square',
        'direction': 'Downtown',
        'area': '4/5 Lines', 
        'feed': '456',
        'row': 1
    },
    'whitehall_rw_downtown': {
        'station_id': 'R45S',  # Whitehall-S Ferry, Southbound (downtown)
        'routes': ['R', 'W'],
        'name': 'Whitehall-S Ferry',
        'direction': 'Downtown',
        'area': 'R/W Lines',
        'feed': 'nqrw',
        'row': 1,
        'column': 2,
        'sub_row': 2
    },
    'whitehall_rw': {
        'station_id': 'R45N',  # Whitehall-S Ferry, Northbound (uptown)
        'routes': ['R', 'W'],
        'name': 'Whitehall-S Ferry',
        'direction': 'Uptown',
        'area': 'R/W Lines',
        'feed': 'nqrw',
        'row': 2
    },
    'union_square_q': {
        'station_id': 'R20N',  # Union Square, Northbound (uptown)
        'routes': ['Q'],
        'name': 'Union Square',
        'direction': 'Uptown',
        'area': 'Q Line',
        'feed': 'nqrw',
        'row': 2
    },
    'bowling_green_45_downtown': {
        'station_id': '420S',  # Bowling Green, Southbound (downtown)
        'routes': ['4', '5'],
        'name': 'Bowling Green',
        'direction': 'Downtown',
        'area': '4/5 Lines',
        'feed': '456',
        'row': 1,
        'column': 3,
        'sub_row': 2
    },
    'bowling_green_45': {
        'station_id': '420N',  # Bowling Green, Northbound (uptown) - 4/5/6 system uses different IDs
        'routes': ['4', '5'],
        'name': 'Bowling Green',
        'direction': 'Uptown',
        'area': '4/5 Lines',
        'feed': '456',
        'row': 2
    },
    'q_86th_uptown': {
        'station_id': 'Q05N',  # 86 St, Northbound (uptown)
        'routes': ['Q'],
        'name': '86th Street',
        'direction': 'Uptown',
        'area': 'Upper East Side',
        'feed': 'nqrw',
        'row': 2,
        'column': 2,
        'sub_row': 2
    },
    '45_86th_uptown': {
        'station_id': '621N',  # 86 St, Northbound (uptown) - 4/5/6 system uses different IDs
        'routes': ['4', '5'],
        'name': '86th Street',
        'direction': 'Uptown',
        'area': '4/5 Lines',
        'feed': '456',
        'row': 2,
        'column': 2,
        'sub_row': 2
    }
}

def fetch_feed(feed_url):
    """Fetch GTFS-Realtime data from MTA API"""
    try:
        resp = requests.get(feed_url, timeout=10)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        print(f"Error fetching feed from {feed_url}: {e}")
        return None

def parse_feed(data):
    """Parse the GTFS-Realtime data"""
    try:
        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(data)
        return feed
    except Exception as e:
        print(f"Error parsing feed: {e}")
        return None

def get_arrivals_for_station(feed, station_config):
    """Extract arrival times for the specified station and routes"""
    if not feed:
        return []
    
    now = datetime.datetime.now().timestamp()
    arrivals = []
    
    for entity in feed.entity:
        if not entity.HasField("trip_update"):
            continue
        
        trip = entity.trip_update.trip
        if trip.route_id not in station_config['routes']:
            continue
        
        for stu in entity.trip_update.stop_time_update:
            if stu.stop_id == station_config['station_id'] and stu.HasField("arrival"):
                arrival_ts = stu.arrival.time
                minutes_away = int((arrival_ts - now) / 60)
                
                # Only show trains arriving in the future
                if minutes_away >= 0:
                    # Convert timestamp to Eastern Time
                    eastern = pytz.timezone('America/New_York')
                    dt = datetime.datetime.fromtimestamp(arrival_ts, tz=eastern).strftime("%H:%M")
                    arrivals.append({
                        'minutes': minutes_away,
                        'time': dt,
                        'timestamp': arrival_ts,
                        'route': trip.route_id
                    })
    
    return sorted(arrivals, key=lambda x: x['minutes'])

def get_all_arrivals():
    """Get arrivals for all configured stations"""
    results = {}
    feeds_cache = {}  # Cache feeds to avoid multiple requests for same feed
    
    for station_key, station_config in STATIONS.items():
        feed_name = station_config['feed']
        feed_url = FEEDS[feed_name]
        
        # Get feed data (cached if already fetched)
        if feed_name not in feeds_cache:
            raw_data = fetch_feed(feed_url)
            if raw_data:
                feeds_cache[feed_name] = parse_feed(raw_data)
            else:
                feeds_cache[feed_name] = None
        
        feed = feeds_cache[feed_name]
        arrivals = get_arrivals_for_station(feed, station_config)
        results[station_key] = {
            'station': station_config,
            'arrivals': arrivals[:20]  # Get many more trains to ensure we always have 5+ viable options
        }
    
    return results

@app.route('/')
def index():
    """Serve the main page"""
    return send_file('index.html')

@app.route('/styles.css')
def styles():
    """Serve the CSS file"""
    return send_file('styles.css')

@app.route('/script.js')
def script():
    """Serve the JavaScript file"""
    return send_file('script.js')

@app.route('/api/arrivals')
def api_arrivals():
    """API endpoint to get current arrival times for all stations"""
    try:
        all_arrivals = get_all_arrivals()
        total_trains = sum(len(station_data['arrivals']) for station_data in all_arrivals.values())
        
        return jsonify({
            'status': 'success',
            'message': f'Found {total_trains} upcoming trains across {len(all_arrivals)} stations',
            'last_updated': datetime.datetime.now(pytz.timezone('America/New_York')).strftime("%H:%M:%S"),
            'stations': all_arrivals
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}',
            'stations': {}
        })

if __name__ == '__main__':
    print("Starting Q Train arrival tracker...")
    print("Visit http://localhost:5000 to view arrivals")
    app.run(debug=True, host='0.0.0.0', port=5000)