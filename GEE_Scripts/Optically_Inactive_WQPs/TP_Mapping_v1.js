// =============================================================================
// NEAR REAL-TIME WATER QUALITY MONITORING
// Parameter  : Total Phosphorus — TP (mg/L)
// Model      : Random Forest (smileRandomForest, 100 trees)
// Output     : Monthly mean maps — Chao Phraya & Khlong Nueng (2024)
// Indices    : SWIR2, B6_B7  [+ in-situ TDS, Turbidity as hybrid features]
// Assets     : tpCombined | tdsCombined | turbidityCombined | Chao_Phraya | Khlong_Nueng
// =============================================================================

// Study area polygon
var Pathum_Thani = ee.Geometry.Polygon([
  [[100.49344515247942, 13.911774187300836], 
   [100.78595613880755, 13.911774187300836], 
   [100.78595613880755, 14.135610659931288], 
   [100.49344515247942, 14.135610659931288], 
   [100.49344515247942, 13.911774187300836]]
]);

// Selected Dates for training/validation/testing
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
  ee.Feature(ee.Geometry.Point([100.5585, 14.0534]), {Zone: 3, Station: 'Ban Phrao Pt1'}),
  ee.Feature(ee.Geometry.Point([100.5557, 14.05214]), {Zone: 3, Station: 'Ban Phrao Pt2'}),
  ee.Feature(ee.Geometry.Point([100.5553, 14.05188]), {Zone: 3, Station: 'Ban Phrao Pt3'}),
  ee.Feature(ee.Geometry.Point([100.5542, 14.05183]), {Zone: 3, Station: 'Ban Phrao Pt4'})
]);

// Spectral indices calculation for TP (Adapted to SWIR2 and B6_B7)
function calculateIndices(image) {
  var SWIR2 = image.select('SR_B7').rename('SWIR2');
  var B6_B7 = image.select('SR_B6').add(image.select('SR_B7')).rename('B6_B7');
  return image.addBands([SWIR2, B6_B7]);
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
function prepareTrainingData(landsatImage, tpFeatureCollection, tdsCollection, turbidityCollection) {
  var image = ee.Image(landsatImage);
  var imageWithIndices = calculateIndices(image);
  var imageDate = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd');

  var dateFilteredTP = tpFeatureCollection.filter(ee.Filter.equals('date', imageDate));
  var dateFilteredTDS = tdsCollection.filter(ee.Filter.equals('date', imageDate));
  var dateFilteredTurbidity = turbidityCollection.filter(ee.Filter.equals('date', imageDate));

  var trainingPoints = samplingPoints.map(function(point) {
    var values = imageWithIndices.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point.geometry(),
      scale: 30,
      maxPixels: 1e9
    });

    var matchingTP = dateFilteredTP
      .filter(ee.Filter.equals('station', point.get('Station')))
      .filter(ee.Filter.equals('zone', point.get('Zone')))
      .first();

    var matchingTDS = dateFilteredTDS
      .filter(ee.Filter.equals('station', point.get('Station')))
      .filter(ee.Filter.equals('zone', point.get('Zone')))
      .first();

    var matchingTurbidity = dateFilteredTurbidity
      .filter(ee.Filter.equals('station', point.get('Station')))
      .filter(ee.Filter.equals('zone', point.get('Zone')))
      .first();

    return ee.Feature(point.geometry(), {
      'SWIR2': values.get('SWIR2'),
      'B6_B7': values.get('B6_B7'),
      'tdsCombined': ee.Number(ee.Algorithms.If(
        matchingTDS,
        matchingTDS.get('TDS'),
        null
      )),
      'turbidityCombined': ee.Number(ee.Algorithms.If(
        matchingTurbidity,
        matchingTurbidity.get('Turbidity'),
        null
      )),
      'TP': ee.Number(ee.Algorithms.If(
        matchingTP,
        matchingTP.get('TP'),
        null
      )),
      'Station': point.get('Station'),
      'Zone': point.get('Zone'),
      'date': imageDate
    });
  });

  return trainingPoints.filter(ee.Filter.notNull(['TP', 'tdsCombined', 'turbidityCombined']));
}

// Define landsatCollection
var landsatCollection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
  .filterBounds(Pathum_Thani)
  .select(['SR_B5', 'SR_B6', 'SR_B7'])
  .map(function(image) { 
    return image
      .multiply(0.0000275)
      .add(-0.2)
      .copyProperties(image, ['system:time_start']);
  });

// Alignment between in-situ and satellite data before splitting
var filteredCollection = getFilteredCollection(landsatCollection, selectedDateList);

var allFeatures = filteredCollection.map(function(image) {
  var imageDate = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd');

  var dateFilteredTP = tpCombined.filter(ee.Filter.equals('date', imageDate));
  var dateFilteredTDS = tdsCombined.filter(ee.Filter.equals('date', imageDate));
  var dateFilteredTurbidity = turbidityCombined.filter(ee.Filter.equals('date', imageDate));

  var matchedPoints = samplingPoints
    .filter(ee.Filter.inList('Station', dateFilteredTP.aggregate_array('station')))
    .filter(ee.Filter.inList('Zone', dateFilteredTP.aggregate_array('zone')))
    .filter(ee.Filter.inList('Station', dateFilteredTDS.aggregate_array('station')))
    .filter(ee.Filter.inList('Zone', dateFilteredTDS.aggregate_array('zone')))
    .filter(ee.Filter.inList('Station', dateFilteredTurbidity.aggregate_array('station')))
    .filter(ee.Filter.inList('Zone', dateFilteredTurbidity.aggregate_array('zone')));

  return prepareTrainingData(image, dateFilteredTP, dateFilteredTDS, dateFilteredTurbidity)
    .filter(ee.Filter.inList('Station', matchedPoints.aggregate_array('Station')))
    .filter(ee.Filter.inList('Zone', matchedPoints.aggregate_array('Zone')));
}).flatten();

allFeatures = allFeatures.filter(ee.Filter.notNull(['TP', 'tdsCombined', 'turbidityCombined', 'SWIR2', 'B6_B7']));

var seed = 42;
var withRandom = allFeatures.randomColumn('random', seed);

var trainingTP = withRandom.filter(ee.Filter.lt('random', 0.80));
var validationTP = withRandom.filter(ee.Filter.and(
  ee.Filter.gte('random', 0.80),
  ee.Filter.lt('random', 0.94)
));
var testingTP = withRandom.filter(ee.Filter.gte('random', 0.94));

print('Total features:', allFeatures.size());
print('Training set size:', trainingTP.size());
print('Validation set size:', validationTP.size());
print('Testing set size:', testingTP.size());

// Z-score standardisation — statistics derived from training set only
function standardizeFeatures(trainingSet, featureCollections) {
  var features = ['tdsCombined', 'turbidityCombined', 'SWIR2', 'B6_B7'];
  var means = {};
  var stdDevs = {};

  features.forEach(function(feat) {
    var meanVal = ee.Number(trainingSet.reduceColumns({
      reducer: ee.Reducer.mean(),
      selectors: [feat]
    }).get('mean'));

    var stdVal = ee.Number(trainingSet.reduceColumns({
      reducer: ee.Reducer.stdDev(),
      selectors: [feat]
    }).get('stdDev'));

    means[feat] = meanVal;
    stdDevs[feat] = stdVal;
  });

  var meanDict = ee.Dictionary(means);
  var stdDict = ee.Dictionary(stdDevs);

  var normalizedCollections = featureCollections.map(function(collection) {
    return collection.map(function(feature) {
      var normalized = {};
      features.forEach(function(feat) {
        var val = ee.Number(feature.get(feat));
        var mean = ee.Number(means[feat]);
        var stdDev = ee.Number(stdDevs[feat]);

        var normVal = ee.Algorithms.If(
          ee.Algorithms.IsEqual(stdDev, null),
          val,
          ee.Algorithms.If(
            stdDev.gt(0),
            val.subtract(mean).divide(stdDev),
            val.subtract(mean)
          )
        );

        normalized[feat] = normVal;
      });
      return feature.set(normalized);
    });
  });

  return {
    normalizedCollections: normalizedCollections,
    means: meanDict,
    stdDevs: stdDict
  };
}

var normalizationResult = standardizeFeatures(
  trainingTP,
  [trainingTP, validationTP, testingTP]
);

var normalizedTraining = normalizationResult.normalizedCollections[0];
var normalizedValidation = normalizationResult.normalizedCollections[1];
var normalizedTesting = normalizationResult.normalizedCollections[2];

var meanDict = normalizationResult.means;
var stdDict = normalizationResult.stdDevs;

var trainedModel = ee.Classifier.smileRandomForest(100)
  .setOutputMode('REGRESSION')
  .train({
    features: normalizedTraining,
    classProperty: 'TP',
    inputProperties: ['tdsCombined', 'turbidityCombined', 'SWIR2', 'B6_B7']
  });

// Apply z-score normalization to prediction images using training-set statistics
function normalizeImage(image, tdsImg, turbidityImg) {
  var features = ['tdsCombined', 'turbidityCombined', 'SWIR2', 'B6_B7'];
  var normalized = image;

  normalized = normalized.addBands(tdsImg.rename('tdsCombined'));
  normalized = normalized.addBands(turbidityImg.rename('turbidityCombined'));

  features.forEach(function(feat) {
    var mean = ee.Number(meanDict.get(feat));
    var stdDev = ee.Number(stdDict.get(feat));

    var normBand = ee.Image(ee.Algorithms.If(
      ee.Algorithms.IsEqual(stdDev, null),
      normalized.select(feat),
      ee.Algorithms.If(
        stdDev.gt(0),
        normalized.select(feat).subtract(mean).divide(stdDev),
        normalized.select(feat).subtract(mean)
      )
    )).rename(feat);

    normalized = normalized.addBands(normBand, null, true);
  });
  return normalized;
}

// =============================================================================
// PREDICTION AND MAPPING SECTION - Monthly Average using toBands()
// =============================================================================

var predictionYear = 2024;
var predictionYearString = predictionYear.toString();

var waterBodies = {
  'Chao_Phraya': Chao_Phraya,
  'Khlong_Nueng': Khlong_Nueng
};

var allPredictedImages = {};

var defaultTdsValue = ee.Number(meanDict.get('tdsCombined'));
var defaultTurbidityValue = ee.Number(meanDict.get('turbidityCombined'));

var monthsArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

Object.keys(waterBodies).forEach(function(waterBodyName) {
  var waterBody = waterBodies[waterBodyName];

  var landsatCollectionYear = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
    .filterBounds(waterBody)
    .filterDate('2024-01-01', '2025-12-31')
    .select(['SR_B5', 'SR_B6', 'SR_B7'])
    .map(function(image) {
      return image.multiply(0.0000275).add(-0.2).clip(waterBody).copyProperties(image, ['system:time_start']);
    });

  var landsatWithIndicesYear = landsatCollectionYear.map(calculateIndices);

  // FIX: Map normalization directly like the Turbidity reference script
  var normalizedImagesYear = landsatWithIndicesYear.map(function(img) {
    var fallbackTDS = ee.Image.constant(defaultTdsValue).rename('tdsCombined');
    var fallbackTurbidity = ee.Image.constant(defaultTurbidityValue).rename('turbidityCombined');
    return normalizeImage(img, fallbackTDS, fallbackTurbidity);
  });

  // FIX: Map classification directly (guarantees properties carry over without null dropping)
  var predictedImagesYear = normalizedImagesYear.map(function(img) {
    return img.classify(trainedModel)
      .rename('TP')
      .copyProperties(img, img.propertyNames())
      .set('water_body', waterBodyName);
  });

  allPredictedImages[waterBodyName] = predictedImagesYear;

  predictedImagesYear.size().evaluate(function(size, error) {
    if (error) {
      print('Error predicting images for ' + waterBodyName + ':', error);
    } else {
      print(waterBodyName + '_Total_Predicted_Images:', size);
      print('Initiating monthly average calculations for TP in ' + waterBodyName + '...');
    }
  });

  monthsArray.forEach(function(month) {
    var startDate = ee.Date.fromYMD(predictionYear, month, 1);
    var endDate = startDate.advance(1, 'month');
    var monthlyCollection = predictedImagesYear.filterDate(startDate, endDate);

    monthlyCollection.size().evaluate(function(numberOfImages) {
      if (numberOfImages > 0) {
        var monthlyStack = monthlyCollection.toBands();
        var monthlyMeanImage = monthlyStack.reduce('mean').rename('TP')
          .set('month', startDate.format('YYYY-MM'))
          .set('water_body', waterBodyName);

        var monthStr = month < 10 ? '0' + month : month.toString();
        var exportName = waterBodyName + '_TP_MonthlyAvg_' + predictionYear + '-' + monthStr;

        // EXPORT — Uncomment to generate monthly GeoTIFFs in Google Drive
        /*
        Export.image.toDrive({
          image: monthlyMeanImage,
          description: exportName,
          folder: 'Landsat8_9_TP_Monthly_Avg_Prediction_Images_' + predictionYearString,
          scale: 30,
          crs: 'EPSG:4326',
          region: waterBody,
          fileFormat: 'GeoTIFF',
          maxPixels: 1e13
        });
        */
      }
    });
  });
});

var visParams = {
  min: 0,
  max: 0.5,
  palette: ['lightyellow', 'yellow', 'orange', 'red']
};

var visualizationMonth = '2024-07';
var visualizationStart = ee.Date(visualizationMonth + '-01');
var visualizationEnd = visualizationStart.advance(1, 'month');

var chaoPhrayaImagesVis = allPredictedImages['Chao_Phraya'].filter(ee.Filter.date(visualizationStart, visualizationEnd));
var chaoPhrayaMonthlyMeanVis = chaoPhrayaImagesVis.mean();
if (chaoPhrayaMonthlyMeanVis) {
  Map.addLayer(chaoPhrayaMonthlyMeanVis, visParams, 'Chao_Phraya_TP_' + visualizationMonth);
}

var khlongNuengImagesVis = allPredictedImages['Khlong_Nueng'].filter(ee.Filter.date(visualizationStart, visualizationEnd));
var khlongNuengMonthlyMeanVis = khlongNuengImagesVis.mean();
if (khlongNuengMonthlyMeanVis) {
  Map.addLayer(khlongNuengMonthlyMeanVis, visParams, 'Khlong_Nueng_TP_' + visualizationMonth);
}

Map.centerObject(Pathum_Thani, 12);