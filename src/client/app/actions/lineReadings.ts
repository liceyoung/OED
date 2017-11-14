/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import axios from 'axios';
import * as moment from 'moment';
import { TimeInterval } from '../../../common/TimeInterval';
import { LineReadings } from '../utils/types';

export const REQUEST_GROUP_LINE_READINGS = 'REQUEST_GROUP_LINE_READINGS';
export const RECEIVE_GROUP_LINE_READINGS = 'RECEIVE_GROUP_LINE_READINGS';

export const REQUEST_METER_LINE_READINGS = 'REQUEST_METER_LINE_READINGS';
export const RECEIVE_METER_LINE_READINGS = 'RECEIVE_METER_LINE_READINGS';

export interface RequestMeterLineReadingsAction {
	type: 'REQUEST_METER_LINE_READINGS';
	meterIDs: number[];
	timeInterval: TimeInterval;
}

export interface RequestGroupLineReadingsAction {
	type: 'REQUEST_GROUP_LINE_READINGS';
	groupIDs: number[];
	timeInterval: TimeInterval;
}

export interface ReceiveMeterLineReadingsAction {
	type: 'RECEIVE_METER_LINE_READINGS';
	meterIDs: number[];
	timeInterval: TimeInterval;
	readings: LineReadings;
}

export interface ReceiveGroupLineReadingsAction {
	type: 'RECEIVE_GROUP_LINE_READINGS';
	groupIDs: number[];
	timeInterval: TimeInterval;
	readings: LineReadings;
}

export type LineReadingsAction =
	ReceiveMeterLineReadingsAction |
	ReceiveGroupLineReadingsAction |
	RequestMeterLineReadingsAction |
	RequestGroupLineReadingsAction;

/**
 * @param {State} state The current Redux state
 * @param {number} groupID The ID of the group to check
 * @param {TimeInterval} timeInterval The time interval to check
 * @returns {bool} True if the line readings for the given group at the given time are missing, false otherwise
 */
function shouldFetchGroupLineReadings(state, groupID: number, timeInterval: TimeInterval): boolean {
	const timeIntervalIndex = timeInterval.toString();
	const readingsForID = state.readings.line.byGroupID[groupID];
	if (readingsForID === undefined) {
		return true;
	}

	const readingsForTimeInterval = readingsForID[timeIntervalIndex];
	if (readingsForID[timeIntervalIndex] === undefined) {
		return true;
	}

	return !readingsForTimeInterval.isFetching;
}

/**
 * @param {State} state The current Redux state
 * @param {number} meterID The ID of the meter to check
 * @param {TimeInterval} timeInterval The time interval to check
 * @returns {bool} True if the line readings for the given meter at the given time are missing, false otherwise
 */
function shouldFetchMeterLineReadings(state, meterID: number, timeInterval: TimeInterval): boolean {
	const timeIntervalIndex = timeInterval.toString();
	const readingsForID = state.readings.line.byMeterID[meterID];
	if (readingsForID === undefined) {
		return true;
	}

	const readingsForTimeInterval = readingsForID[timeIntervalIndex];
	if (readingsForID[timeIntervalIndex] === undefined) {
		return true;
	}

	return !readingsForTimeInterval.isFetching;
}

/**
 * @param {[number]} meterIDs The IDs of the meters whose data should be fetched
 * @param {TimeInterval} timeInterval The time interval over which data should be fetched
 */
function requestMeterLineReadings(meterIDs: number[], timeInterval: TimeInterval): RequestMeterLineReadingsAction {
	return { type: REQUEST_METER_LINE_READINGS, meterIDs, timeInterval };
}

/**
 * @param {[number]} meterIDs The IDs of the meters whose data has been fetched
 * @param {TimeInterval} timeInterval The time interval over which data has been fetched
 * @param {*} readings The data that has been fetched, indexed by meter ID.
 */
function receiveMeterLineReadings(meterIDs: number[], timeInterval: TimeInterval, readings): ReceiveMeterLineReadingsAction {
	return { type: RECEIVE_METER_LINE_READINGS, meterIDs, timeInterval, readings };
}

/**
 * @param {[number]} groupIDs The IDs of the groups whose data should be fetched
 * @param {TimeInterval} timeInterval The time interval over which data should be fetched
 */
function requestGroupLineReadings(groupIDs: number[], timeInterval: TimeInterval): RequestGroupLineReadingsAction {
	return { type: REQUEST_GROUP_LINE_READINGS, groupIDs, timeInterval };
}

/**
 * @param {[number]} groupIDs The IDs of the groups whose data has been fetched
 * @param {TimeInterval} timeInterval The time interval over which data has been fetched
 * @param {*} readings The data that has been fetched, indexed by group ID.
 */
function receiveGroupLineReadings(groupIDs: number[], timeInterval: TimeInterval, readings): ReceiveGroupLineReadingsAction {
	return { type: RECEIVE_GROUP_LINE_READINGS, groupIDs, timeInterval, readings };
}

/**
 * Fetch the data for the given meters over the given interval. Fully manages the Redux lifecycle.
 * @param {[number]} meterIDs The IDs of the meters whose data should be fetched
 * @param {TimeInterval} timeInterval The time interval over which data should be fetched
 */
function fetchMeterLineReadings(meterIDs: number[], timeInterval: TimeInterval) {
	return dispatch => {
		dispatch(requestMeterLineReadings(meterIDs, timeInterval));
		// The api expects the meter IDs to be a comma-separated list.
		const stringifiedIDs = meterIDs.join(',');
		return axios.get(`/api/readings/line/meters/${stringifiedIDs}`, {
			params: { timeInterval: timeInterval.toString() }
		}).then(response => dispatch(receiveMeterLineReadings(meterIDs, timeInterval, response.data)));
	};
}

/**
 * Fetch the data for the given groups over the given interval. Fully manages the Redux lifecycle.
 * @param {[number]} groupIDs The IDs of the groups whose data should be fetched
 * @param {TimeInterval} timeInterval The time interval over which data should be fetched
 */
function fetchGroupLineReadings(groupIDs: number[], timeInterval: TimeInterval) {
	return dispatch => {
		dispatch(requestGroupLineReadings(groupIDs, timeInterval));
		// The api expects the group IDs to be a comma-separated list.
		const stringifiedIDs = groupIDs.join(',');
		return axios.get(`/api/readings/line/groups/${stringifiedIDs}`, {
			params: { timeInterval: timeInterval.toString() }
		}).then(response => dispatch(receiveGroupLineReadings(groupIDs, timeInterval, response.data)));
	};
}

/**
 * Fetches readings for the line chart of all selected meters and groups, if needed.
 * @param {TimeInterval} timeInterval The time interval to fetch readings for on the line chart
 * @return {*} Promise resolution of async actions to fetch the needed readings.
 */
export function fetchNeededLineReadings(timeInterval: TimeInterval) {
	return (dispatch, getState) => {
		const state = getState();
		const promises: Array<Promise<any>> = [];

		// Determine which meters are missing data for this time interval
		const meterIDsToFetchForLine = state.graph.selectedMeters.filter(
			id => shouldFetchMeterLineReadings(state, id, timeInterval)
		);
		if (meterIDsToFetchForLine.length > 0) {
			promises.push(dispatch(fetchMeterLineReadings(meterIDsToFetchForLine, timeInterval)));
		}

		// Determine which groups are missing data for this time interval
		const groupIDsToFetchForLine = state.graph.selectedGroups.filter(
			id => shouldFetchGroupLineReadings(state, id, timeInterval)
		);
		if (groupIDsToFetchForLine.length > 0) {
			promises.push(dispatch(fetchGroupLineReadings(groupIDsToFetchForLine, timeInterval)));
		}

		return Promise.all(promises);
	};
}
