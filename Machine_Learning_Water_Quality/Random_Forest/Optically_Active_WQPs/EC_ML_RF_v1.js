// =============================================================================
// NEAR REAL-TIME WATER QUALITY MONITORING
// Parameter  : Electrical Conductivity (µS/cm)
// Model      : Random Forest (smileRandomForest, 100 trees)
// Split      : ~82% training / ~10% validation / ~8% testing
// Indices    : B2_B4, B2_B3, B2_B7, C
// Asset      : ecCombined  (GEE FeatureCollection)
// =============================================================================

// Study area polygon
var Pathum_Thani = ee.Geometry.Polygon([
  [[100.49344515247942, 13.911774187300836],
   [100.78595613880755, 13.911774187300836],
   [100.78595613880755, 14.135610659931288],
   [100.49344515247942, 14.135610659931288],
   [100.49344515247942, 13.911774187300836]]
]);

// Selected Dates
var selectedDateList = ['2024-06-21', '2024-06-29', '2024-07-07', '2024-07-15',
                        '2024-07-23', '2024-07-31', '2024-08-08', '2024-08-16',
                        '2024-08-24', '2024-09-01', '2024-09-09', '2024-09-17',
                        '2024-10-19', '2024-10-27', '2024-11-04', '2024-11-12',
                        '2024-11-20', '2024-11-28', '2024-12-06', '2024-12-22',
                        '2024-12-30', '2025-01-07'];

// Combined sampling points for all zones
var samplingPoints = ee.FeatureCollection([
  // Zone 1
  ee.Feature(ee.Geometry.Point([100.620189, 14.082205]), {Zone: 1, Station: 'Talad Thai Pt1'}),
  ee.Feature(ee.Geometry.Point([100.620189, 14.081055]), {Zone: 1, Station: 'Talad Thai Pt2'}),
  ee.Feature(ee.Geometry.Point([100.620228, 14.077457]), {Zone: 1, Station: 'Talad Thai Pt3'}),
  // Zone 2
  ee.Feature(ee.Geometry.Point([100.560725, 14.038922]), {Zone: 2, Station: 'Khlong Bang Luang Pt1'}),
  ee.Feature(ee.Geometry.Point([100.554583, 14.040492]), {Zone: 2, Station: 'Khlong Bang Luang Pt2'}),
  ee.Feature(ee.Geometry.Point([100.557736, 14.039386]), {Zone: 2, Station: 'Khlong Bang Luang Pt3'}),
  ee.Feature(ee.Geometry.Point([100.557125, 14.040869]), {Zone: 2, Station: 'Khlong Bang Luang Pt4'}),
  // Zone 3
  ee.Feature(ee.Geometry.Point([100.5585,  14.0534  ]), {Zone: 3, Station: 'Ban Phrao Pt1'}),
  ee.Feature(ee.Geometry.Point([100.5557,  14.05214 ]), {Zone: 3, Station: 'Ban Phrao Pt2'}),
  ee.Feature(ee.Geometry.Point([100.5553,  14.05188 ]), {Zone: 3, Station: 'Ban Phrao Pt3'}),
  ee.Feature(ee.Geometry.Point([100.5542,  14.05183 ]), {Zone: 3, Station: 'Ban Phrao Pt4'})
]);

// Spectral indices calculation for EC
function calculateIndices(image) {
  var B2_B4 = image.select('SR_B2').divide(image.select('SR_B4')).rename('B2_B4');
  var B2_B3 = image.select('SR_B2').divide(image.select('SR_B3')).rename('B2_B3');
  var B2_B7 = image.select('SR_B2').add(image.select('SR_B7')).rename('B2_B7');
  var C     = image.select('SR_B1').rename('C');
  return image.addBands([B2_B4, B2_B3, B2_B7, C]);
}

// Optimized filtered collection function
function getFilteredCollection(collection, dates) {
  return ee.ImageCollection.fromImages(
    dates.map(function(date) {
      var dateObj = ee.Date(date);
      return collection
        .filterDate(dateObj.advance(-1, 'day'), dateObj.advance(1, 'day'))
        .mean()
        .set('system:time_start', dateObj.millis())
        .set('date', dateObj);
    })
  );
}

// Training data preparation
function prepareTrainingData(landsatImage, ecFC) {
  var image = ee.Image(landsatImage);
  var imageWithIndices = calculateIndices(image);
  var imageDate = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd');
  var dateFilteredEC = ecFC.filter(ee.Filter.equals('date', imageDate));

  var trainingPoints = samplingPoints.map(function(point) {
    var values = imageWithIndices.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point.geometry(),
      scale: 30,
      maxPixels: 1e9
    });
    var matchingEC = dateFilteredEC
      .filter(ee.Filter.equals('station', point.get('Station')))
      .filter(ee.Filter.equals('zone',    point.get('Zone')))
      .first();
    return ee.Feature(point.geometry(), {
      'B2_B4'  : values.get('B2_B4'),
      'B2_B3'  : values.get('B2_B3'),
      'B2_B7'  : values.get('B2_B7'),
      'C'      : values.get('C'),
      'EC'     : ee.Number(ee.Algorithms.If(matchingEC, matchingEC.get('EC'), null)),
      'Station': point.get('Station'),
      'Zone'   : point.get('Zone'),
      'date'   : imageDate
    });
  });
  return trainingPoints.filter(ee.Filter.notNull(['EC']));
}

// Landsat 8/9 collection — SR scale 0.0000275, offset -0.2
var landsatCollection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
  .filterBounds(Pathum_Thani)
  .select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B7'])
  .map(function(image) {
    return image.multiply(0.0000275).add(-0.2)
      .copyProperties(image, ['system:time_start']);
  });

// In-situ data asset — replace with your own FeatureCollection path if adapting
var ecCombined = ee.FeatureCollection('projects/ee-st124278/assets/WQ_Combined/ecCombined');

var filteredCollection = getFilteredCollection(landsatCollection, selectedDateList);

var allFeatures = filteredCollection.map(function(image) {
  var imageDate = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd');
  var dateFilteredEC = ecCombined.filter(ee.Filter.equals('date', imageDate));
  var matchedPoints = samplingPoints
    .filter(ee.Filter.inList('Station', dateFilteredEC.aggregate_array('station')))
    .filter(ee.Filter.inList('Zone',    dateFilteredEC.aggregate_array('zone')));
  return prepareTrainingData(image, dateFilteredEC)
    .filter(ee.Filter.inList('Station', matchedPoints.aggregate_array('Station')))
    .filter(ee.Filter.inList('Zone',    matchedPoints.aggregate_array('Zone')));
}).flatten();

allFeatures = allFeatures.filter(ee.Filter.notNull(['EC', 'B2_B4', 'B2_B3', 'B2_B7', 'C']));

// Results will vary — published metrics are in /prediction_csvs/
var withRandom = allFeatures.randomColumn('random');

var training   = withRandom.filter(ee.Filter.lt('random', 0.82));
var validation = withRandom.filter(ee.Filter.and(
  ee.Filter.gte('random', 0.82), ee.Filter.lt('random', 0.92)
));
var testing    = withRandom.filter(ee.Filter.gte('random', 0.92));

print('Total features:',      allFeatures.size());
print('Training set size:',   training.size());
print('Validation set size:', validation.size());
print('Testing set size:',    testing.size());

// Z-score standardisation — statistics from training set only
function standardizeFeatures(trainingSet, featureCollections) {
  var features = ['B2_B4', 'B2_B3', 'B2_B7', 'C'];
  var means = {}, stdDevs = {};

  features.forEach(function(feat) {
    means[feat]   = ee.Number(trainingSet.reduceColumns({
      reducer: ee.Reducer.mean(), selectors: [feat]
    }).get('mean'));
    stdDevs[feat] = ee.Number(trainingSet.reduceColumns({
      reducer: ee.Reducer.stdDev(), selectors: [feat]
    }).get('stdDev'));
  });

  var normalizedCollections = featureCollections.map(function(collection) {
    return collection.map(function(feature) {
      var normalized = {};
      features.forEach(function(feat) {
        var val    = ee.Number(feature.get(feat));
        var mean   = ee.Number(means[feat]);
        var stdDev = ee.Number(stdDevs[feat]);
        normalized[feat] = ee.Algorithms.If(
          stdDev.gt(0),
          val.subtract(mean).divide(stdDev),
          val.subtract(mean)
        );
      });
      return feature.set(normalized);
    });
  });

  return { normalizedCollections: normalizedCollections };
}

print('Number of Landsat images:', filteredCollection.size());

var normalizationResult  = standardizeFeatures(training, [training, validation, testing]);
var normalizedTraining   = normalizationResult.normalizedCollections[0];
var normalizedValidation = normalizationResult.normalizedCollections[1];
var normalizedTesting    = normalizationResult.normalizedCollections[2];

var trainedModel = ee.Classifier.smileRandomForest(100)
  .setOutputMode('REGRESSION')
  .train({
    features       : normalizedTraining,
    classProperty  : 'EC',
    inputProperties: ['B2_B4', 'B2_B3', 'B2_B7', 'C']
  });

var trainingPredictions   = normalizedTraining.classify(trainedModel);
var validationPredictions = normalizedValidation.classify(trainedModel);
var testingPredictions    = normalizedTesting.classify(trainedModel);

// Performance metrics
function calculatePerformanceMetrics(predictions) {
  var errorFeatures = predictions.map(function(feature) {
    var predicted = ee.Number(feature.get('classification'));
    var observed  = ee.Number(feature.get('EC'));
    var error     = predicted.subtract(observed);
    return feature.set({
      'squared_error' : error.pow(2),
      'absolute_error': error.abs()
    });
  });

  var mae  = ee.Number(errorFeatures.reduceColumns({
    reducer: ee.Reducer.mean(), selectors: ['absolute_error']
  }).get('mean'));

  var rmse = ee.Number(errorFeatures.reduceColumns({
    reducer: ee.Reducer.mean(), selectors: ['squared_error']
  }).get('mean')).sqrt();

  var r2   = ee.Number(errorFeatures.reduceColumns({
    reducer: ee.Reducer.pearsonsCorrelation(),
    selectors: ['classification', 'EC']
  }).get('correlation')).pow(2);

  return ee.Dictionary({'n_samples': predictions.size(), 'MAE': mae, 'RMSE': rmse, 'R_squared': r2});
}

var trainingMetrics   = calculatePerformanceMetrics(trainingPredictions);
var validationMetrics = calculatePerformanceMetrics(validationPredictions);
var testingMetrics    = calculatePerformanceMetrics(testingPredictions);

print('Training Metrics:',   trainingMetrics);
print('Validation Metrics:', validationMetrics);
print('Testing Metrics:',    testingMetrics);

// Scatter plots — Observed vs Predicted
function createValidationPlot(predictions, title, metrics) {
  return ui.Chart.feature.byFeature({
    features   : predictions,
    xProperty  : 'EC',
    yProperties: ['classification']
  })
  .setChartType('ScatterChart')
  .setOptions({
    title: title + ' (R\u00B2: ' + ee.Number(metrics.get('R_squared')).format('%.2f').getInfo() +
           ', RMSE: '             + ee.Number(metrics.get('RMSE')).format('%.2f').getInfo() + ')',
    hAxis    : {title: 'Observed EC (\u00B5S/cm)'},
    vAxis    : {title: 'Predicted EC (\u00B5S/cm)'},
    trendlines: {0: {color: 'red', lineWidth: 2, opacity: 0.7, showR2: true, type: 'linear'}},
    pointSize: 5,
    width    : 800,
    height   : 600
  });
}

print('Training Set Validation');
print(createValidationPlot(trainingPredictions,   'Training Set Results',   trainingMetrics));

print('Validation Set Validation');
print(createValidationPlot(validationPredictions, 'Validation Set Results', validationMetrics));

print('Testing Set Validation');
print(createValidationPlot(testingPredictions,    'Testing Set Results',    testingMetrics));
